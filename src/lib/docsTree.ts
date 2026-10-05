// Pure helpers for the documentation section: the nested page tree (any depth), moving pages, breadcrumbs, searching with highlights, tags and "how old is this".
// Kept free of React and Supabase so the rules can be tested.

export interface TreeDoc { id: string; title: string; category_id: string | null; parent_id: string | null; order_index: number; content?: string; tags?: string[] }
export interface TreeCategory { id: string; name: string; order_index: number }

export interface DocNode<T extends TreeDoc> { doc: T; children: DocNode<T>[]; depth: number }
export interface DocSection<T extends TreeDoc> { id: string | null; name: string; nodes: DocNode<T>[]; count: number }

export const UNCATEGORIZED = 'Uncategorized';
const byOrder = <T extends TreeDoc>(a: T, b: T) => a.order_index - b.order_index || a.title.localeCompare(b.title);

// A page's category is the category of its top-level ancestor: only top-level pages choose one, sub-pages follow their parent.
export function buildSections<T extends TreeDoc>(docs: T[], categories: TreeCategory[]): DocSection<T>[] {
  const ids = new Set(docs.map((d) => d.id));
  const kids = new Map<string, T[]>();
  for (const d of docs) if (d.parent_id && ids.has(d.parent_id)) kids.set(d.parent_id, [...(kids.get(d.parent_id) ?? []), d]);
  const node = (d: T, depth: number, seen: Set<string>): DocNode<T> => {
    seen.add(d.id);
    return { doc: d, depth, children: (kids.get(d.id) ?? []).filter((c) => !seen.has(c.id)).sort(byOrder).map((c) => node(c, depth + 1, seen)) };
  };
  // A page whose parent is missing (deleted, or hidden from this reader) counts as top-level.
  const roots = docs.filter((d) => !d.parent_id || !ids.has(d.parent_id));
  const count = (n: DocNode<T>): number => 1 + n.children.reduce((s, c) => s + count(c), 0);
  const cats = [...categories].sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name));
  const make = (id: string | null, name: string): DocSection<T> => {
    const nodes = roots.filter((d) => (d.category_id ?? null) === id).sort(byOrder).map((d) => node(d, 0, new Set()));
    return { id, name, nodes, count: nodes.reduce((s, n) => s + count(n), 0) };
  };
  const sections = cats.map((c) => make(c.id, c.name));
  const loose = make(null, UNCATEGORIZED);
  return [...sections, ...(loose.count ? [loose] : [])].filter((s) => s.count > 0 || s.id !== null);
}

export const flatten = <T extends TreeDoc>(nodes: DocNode<T>[]): T[] => nodes.flatMap((n) => [n.doc, ...flatten(n.children)]);
// Reading order for previous / next: category by category, each page followed by its sub-pages.
export const readingOrder = <T extends TreeDoc>(sections: DocSection<T>[]): T[] => sections.flatMap((s) => flatten(s.nodes));

export function ancestors<T extends TreeDoc>(docs: T[], id: string): T[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const out: T[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parent_id ?? null;
  while (cur && byId.has(cur) && !seen.has(cur)) { seen.add(cur); const d = byId.get(cur)!; out.unshift(d); cur = d.parent_id; }
  return out;
}
export function descendantIds<T extends TreeDoc>(docs: T[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const d of docs) if (d.parent_id === cur && !out.has(d.id)) { out.add(d.id); stack.push(d.id); }
  }
  return out;
}
// Can `id` go under `parentId`? Not under itself or anything inside it.
export const canMoveUnder = <T extends TreeDoc>(docs: T[], id: string, parentId: string | null): boolean => parentId === null || (parentId !== id && !descendantIds(docs, id).has(parentId));
// The category a page belongs to: its own if it is top-level, else its top-level ancestor's.
export function categoryOf<T extends TreeDoc>(docs: T[], id: string): string | null {
  const chain = [...ancestors(docs, id), docs.find((d) => d.id === id)].filter((d): d is T => !!d);
  return chain[0]?.category_id ?? null;
}

// Where a moved page lands among its new siblings: before `beforeId`, or at the end. Returns the order_index to write for every sibling that changes.
export function reorder<T extends TreeDoc>(siblings: T[], movingId: string, beforeId: string | null): { id: string; order_index: number }[] {
  const rest = [...siblings].filter((d) => d.id !== movingId).sort(byOrder);
  const at = beforeId ? rest.findIndex((d) => d.id === beforeId) : -1;
  const ids = rest.map((d) => d.id);
  ids.splice(at === -1 ? ids.length : at, 0, movingId);
  const current = new Map(siblings.map((d) => [d.id, d.order_index]));
  return ids.map((id, i) => ({ id, order_index: i })).filter((r) => current.get(r.id) !== r.order_index);
}

// ── Search ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface SearchHit<T extends TreeDoc> { doc: T; titleMatch: boolean; snippet: string | null; score: number }
const plain = (md: string) => md.replace(/```[\s\S]*?```/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~|-]+/g, ' ').replace(/\s+/g, ' ').trim();
export const searchTerms = (q: string) => q.toLowerCase().split(/\s+/).map((t) => t.trim()).filter(Boolean);

// Every word has to appear somewhere (title, tags or text). Titles and tags rank above body text. The snippet is the stretch of text around the first match.
export function searchDocs<T extends TreeDoc>(docs: T[], query: string): SearchHit<T>[] {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const hits: SearchHit<T>[] = [];
  for (const d of docs) {
    const title = d.title.toLowerCase();
    const tags = (d.tags ?? []).join(' ').toLowerCase();
    const text = plain(d.content ?? '');
    const body = text.toLowerCase();
    if (!terms.every((t) => title.includes(t) || tags.includes(t) || body.includes(t))) continue;
    const titleMatch = terms.some((t) => title.includes(t));
    let score = 0;
    for (const t of terms) score += (title.startsWith(t) ? 6 : title.includes(t) ? 4 : 0) + (tags.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0);
    const first = terms.map((t) => body.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    const snippet = first === undefined ? null : `${first > 50 ? '…' : ''}${text.slice(Math.max(0, first - 50), first + 120).trim()}${text.length > first + 120 ? '…' : ''}`;
    hits.push({ doc: d, titleMatch, snippet, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
}

// Splits text so the matching words can be wrapped for highlighting: [{text, hit}].
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = searchTerms(query).sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length || !text) return [{ text, hit: false }];
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  return text.split(re).filter((p) => p !== '').map((p) => ({ text: p, hit: re.test(p) && (re.lastIndex = 0, true) }));
}

// ── Tags and age ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const MAX_TAGS = 8;
export function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    const v = String(t).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24);
    if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, MAX_TAGS);
}
export const allTags = <T extends TreeDoc>(docs: T[]): { tag: string; count: number }[] => {
  const n = new Map<string, number>();
  for (const d of docs) for (const t of d.tags ?? []) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};

export const STALE_DAYS = 180;
// "Updated today", "Updated 3 weeks ago"; stale = not touched for about six months, so readers know to double-check it.
export function ageLabel(iso: string, now: number = Date.now()): { label: string; stale: boolean } {
  const days = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
  const label = days === 0 ? 'Updated today' : days === 1 ? 'Updated yesterday' : days < 14 ? `Updated ${days} days ago` : days < 60 ? `Updated ${Math.floor(days / 7)} weeks ago` : days < 365 ? `Updated ${Math.floor(days / 30)} months ago` : `Updated ${Math.floor(days / 365)} ${Math.floor(days / 365) === 1 ? 'year' : 'years'} ago`;
  return { label, stale: days >= STALE_DAYS };
}
