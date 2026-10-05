// What other people changed while the docs were open. The page polls a light snapshot of every doc; comparing two snapshots tells it what to say.

export interface SyncDoc {
  id: string; title: string; slug: string; parent_id: string | null; category_id: string | null; order_index: number; revision: number; updated_at: string;
  updated_by_name: string | null; published: boolean; icon: string | null; cover_url: string | null; tags: string[]; pinned: boolean;
  draft_updated_at: string | null; draft_by_name: string | null; draft_by_me: boolean; editing: string[];
}

export type DocChangeKind = 'deleted' | 'created' | 'published' | 'moved' | 'draft' | 'editing';
export interface DocChange { id: string; title: string; kind: DocChangeKind; by: string | null; names?: string[] }

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// What changed between two snapshots, for the notices. Changes you made yourself don't count: published/draft ones are skipped when the author is you (draft_by_me)
// and a publish is only reported when someone else's name is on it.
export function diffSync(prev: SyncDoc[], next: SyncDoc[], myName: string | null = null): DocChange[] {
  const before = new Map(prev.map((d) => [d.id, d]));
  const after = new Map(next.map((d) => [d.id, d]));
  const out: DocChange[] = [];
  for (const d of prev) if (!after.has(d.id)) out.push({ id: d.id, title: d.title, kind: 'deleted', by: null });
  for (const d of next) {
    const was = before.get(d.id);
    if (!was) { out.push({ id: d.id, title: d.title, kind: 'created', by: d.updated_by_name }); continue; }
    if (d.revision > was.revision && d.updated_by_name !== myName) out.push({ id: d.id, title: d.title, kind: 'published', by: d.updated_by_name });
    if ((d.parent_id ?? null) !== (was.parent_id ?? null) || (d.category_id ?? null) !== (was.category_id ?? null)) out.push({ id: d.id, title: d.title, kind: 'moved', by: null });
    if (d.draft_updated_at && d.draft_updated_at !== was.draft_updated_at && !d.draft_by_me) out.push({ id: d.id, title: d.title, kind: 'draft', by: d.draft_by_name });
    if (!sameList(d.editing, was.editing) && d.editing.length) out.push({ id: d.id, title: d.title, kind: 'editing', by: null, names: d.editing });
  }
  return out;
}

export const joinNames = (names: string[]) => names.length <= 1 ? names[0] ?? 'Someone' : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
