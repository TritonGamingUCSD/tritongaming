import type { Doc } from '@/types/database';

// [[Doc title]] (or [[Doc title|shown text]]) links to another doc by its title, the way notes apps do.
// Stored as plain text in the Markdown; it becomes a real link only when a doc is shown.
// The editor saves brackets escaped (\[\[Title\]\]), so both spellings count.
const WIKI = /\\?\[\\?\[([^[\]\n|\\]{1,120})(?:\|([^[\]\n\\]{1,120}))?\\?\]\\?\]/g;
const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

export function docHref(id: string): string { return `/portal/docs?id=${id}`; }

/** Replaces [[Title]] with a Markdown link to the doc with that title; a title no doc has stays as plain text. */
export function resolveWikiLinks(markdown: string, docs: Pick<Doc, 'id' | 'title'>[]): string {
  if (!/\\?\[\\?\[/.test(markdown)) return markdown;
  const byTitle = new Map(docs.map((d) => [norm(d.title), d.id]));
  let inFence = false;
  return markdown.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
    if (inFence) return line;
    return line.replace(WIKI, (_m, title: string, label?: string) => {
      const id = byTitle.get(norm(title));
      const text = (label ?? title).trim();
      return id ? `[${text}](${docHref(id)})` : text;
    });
  }).join('\n');
}

/** The docs that link to this one with [[its title]]. */
export function backlinksTo(doc: Pick<Doc, 'id' | 'title'>, docs: Pick<Doc, 'id' | 'title' | 'content' | 'published'>[], includeDrafts = false): typeof docs {
  const me = norm(doc.title);
  return docs.filter((d) => {
    if (d.id === doc.id || (!d.published && !includeDrafts) || !/\\?\[\\?\[/.test(d.content)) return false;
    for (const m of d.content.matchAll(WIKI)) if (norm(m[1]) === me) return true;
    return false;
  });
}
