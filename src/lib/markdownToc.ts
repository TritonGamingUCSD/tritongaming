// Table-of-contents helpers for Markdown docs. The id function is shared by the
// renderer (MarkdownContent's headingIds) and the TOC so the links always match.
export function headingId(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') || 'section';
}

export interface TocItem { id: string; text: string; level: 2 | 3 }

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    // strip inline markdown (links, emphasis, code) to match the rendered text
    const text = m[2].replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();
    const base = headingId(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    items.push({ id: n === 0 ? base : `${base}-${n}`, text, level: m[1].length as 2 | 3 });
  }
  return items;
}
