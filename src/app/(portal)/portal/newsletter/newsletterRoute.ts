// Where you are in the Newsletter, as an address: /portal/newsletter/…
//   /portal/newsletter                      the issues
//   /portal/newsletter/<issue>              one issue, on Write (the blocks)
//   /portal/newsletter/<issue>/audience     who gets it
//   /portal/newsletter/<issue>/send         the check, the test, sending and how it went
//   /portal/newsletter/<issue>/preview      the email as it will look (a tab of its own on a phone; beside the editor on a laptop)
//   /portal/newsletter/subscribers          the public sign-ups and the sign-up link (senders)
// Officers and above can write; sending is for exec and admins (or anyone granted it).

export const VIEWS = ['write', 'audience', 'send', 'preview'] as const;
export type View = (typeof VIEWS)[number];
export type NewsletterRoute = { tab: 'list' } | { tab: 'subscribers' } | { tab: 'issue'; slug: string; view: View };

export function parseNewsletterRoute(tab: string | undefined, subtab: string | undefined): NewsletterRoute {
  if (!tab) return { tab: 'list' };
  if (tab === 'subscribers') return { tab: 'subscribers' };
  return { tab: 'issue', slug: tab, view: (VIEWS as readonly string[]).includes(subtab ?? '') ? (subtab as View) : 'write' };
}

export function newsletterParams(r: NewsletterRoute): { tab: string | null; subtab: string | null; detail: string | null } {
  if (r.tab === 'subscribers') return { tab: 'subscribers', subtab: null, detail: null };
  return r.tab === 'list' ? { tab: null, subtab: null, detail: null } : { tab: r.slug, subtab: r.view === 'write' ? null : r.view, detail: null };
}
