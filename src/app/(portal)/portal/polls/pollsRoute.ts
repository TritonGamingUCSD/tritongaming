// Where you are in Polls, as an address: /portal/polls/<poll>/…
//   /portal/polls                   the polls
//   /portal/polls/<poll>            one poll: its settings and entries, and Go Live
//   /portal/polls/host/<poll>       running it on the big screen (the whole screen)
// Polls are for officers and above (the Trivia permission); anyone with the code votes on /vote/<code> without an account.

export type PollsRoute = { tab: 'list' } | { tab: 'poll'; slug: string } | { tab: 'host'; slug: string };

export function parsePollsRoute(tab: string | undefined, subtab: string | undefined): PollsRoute {
  if (!tab) return { tab: 'list' };
  if (tab === 'host') return subtab ? { tab: 'host', slug: subtab } : { tab: 'list' };
  return { tab: 'poll', slug: tab };
}

export function pollsParams(r: PollsRoute): { tab: string | null; subtab: string | null; detail: string | null } {
  switch (r.tab) {
    case 'list':
      return { tab: null, subtab: null, detail: null };
    case 'poll':
      return { tab: r.slug, subtab: null, detail: null };
    case 'host':
      return { tab: 'host', subtab: r.slug, detail: null };
  }
}
