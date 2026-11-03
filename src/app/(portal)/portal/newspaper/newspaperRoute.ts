// Where you are in the Newspaper, as an address: /portal/newspaper/…
//   /portal/newspaper                      the issues
//   /portal/newspaper/<issue>              one issue, on Write (the blocks)
//   /portal/newspaper/<issue>/audience     who gets it
//   /portal/newspaper/<issue>/send         the check, the test, sending and how it went
//   /portal/newspaper/<issue>/preview      the email as it will look (a tab of its own on a phone; beside the editor on a laptop)
// Officers and above can write; sending is for exec and admins (or anyone granted it).

export const VIEWS = ['write', 'audience', 'send', 'preview'] as const;
export type View = (typeof VIEWS)[number];
export type NewspaperRoute = { tab: 'list' } | { tab: 'issue'; slug: string; view: View };

export function parseNewspaperRoute(tab: string | undefined, subtab: string | undefined): NewspaperRoute {
  if (!tab) return { tab: 'list' };
  return { tab: 'issue', slug: tab, view: (VIEWS as readonly string[]).includes(subtab ?? '') ? (subtab as View) : 'write' };
}

export function newspaperParams(r: NewspaperRoute): { tab: string | null; subtab: string | null; detail: string | null } {
  return r.tab === 'list' ? { tab: null, subtab: null, detail: null } : { tab: r.slug, subtab: r.view === 'write' ? null : r.view, detail: null };
}
