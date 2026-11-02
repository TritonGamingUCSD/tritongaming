// Where you are in Q&A, as an address: /portal/qa/…
//   /portal/qa                  the Q&A sessions
//   /portal/qa/<session>        one session: the questions to approve and show, and the code
//   /portal/qa/host/<session>   running it on the big screen (the whole screen)
// Q&A is for officers and above (the Trivia permission); anyone with the code asks on /vote/<code> without an account.

export type QaRoute = { tab: 'list' } | { tab: 'session'; slug: string } | { tab: 'host'; slug: string };

export function parseQaRoute(tab: string | undefined, subtab: string | undefined): QaRoute {
  if (!tab) return { tab: 'list' };
  if (tab === 'host') return subtab ? { tab: 'host', slug: subtab } : { tab: 'list' };
  return { tab: 'session', slug: tab };
}

export function qaParams(r: QaRoute): { tab: string | null; subtab: string | null; detail: string | null } {
  switch (r.tab) {
    case 'list':
      return { tab: null, subtab: null, detail: null };
    case 'session':
      return { tab: r.slug, subtab: null, detail: null };
    case 'host':
      return { tab: 'host', subtab: r.slug, detail: null };
  }
}
