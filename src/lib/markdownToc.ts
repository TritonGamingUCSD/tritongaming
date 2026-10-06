// Table-of-contents helpers for Markdown docs. The id function is shared by the
// renderer (MarkdownContent's headingIds) and the TOC so the links always match.
export function headingId(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') || 'section';
}

export interface TocItem { id: string; text: string; level: 1 | 2 | 3 | 4 | 5; line: number }   // line: 1-based, so the renderer can give each heading the same id

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,5})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    // strip inline markdown (links, emphasis, code) to match the rendered text
    const text = m[2].replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();
    const base = headingId(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    items.push({ id: n === 0 ? base : `${base}-${n}`, text, level: m[1].length as 1 | 2 | 3 | 4 | 5, line: i + 1 });
  }
  return items;
}
