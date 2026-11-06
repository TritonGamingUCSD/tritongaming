// Plain-words answers to "who can see and run this?", shown while something is being made and on its lists. Pure functions: the screens only draw what these say, and the rules are the same ones the servers enforce
// (lib/divisions/liveAccess.ts, lib/tournaments/access.ts). `division` is the owning division's name, or null for Triton Gaming.
export interface WhoSees {
  /** One line: whose it is. */
  owner: string;
  /** What each group can do with it. */
  lines: string[];
}

/** A Trivia quiz, poll, Q&A session or photo booth. */
export function liveToolWho(division: string | null): WhoSees {
  return division
    ? {
        owner: `Only ${division}`,
        lines: [
          `${division}’s Heads and Members can see, run and edit it.`,
          'Exec and admin can too.',
          'Triton Gaming’s officers and the other divisions do not see it in their lists.',
          'Players still join with its code or link, like any other.',
        ],
      }
    : {
        owner: 'Triton Gaming',
        lines: [
          'Triton Gaming’s officers and above can see, run and edit it.',
          'Exec and admin can too.',
          'Divisions do not see it in their lists.',
          'Players still join with its code or link, like any other.',
        ],
      };
}

/** A tournament. */
export function tournamentWho(division: string | null, isPublic: boolean): WhoSees {
  const manage = division ? `${division}’s Heads manage it and its Members enter scores.` : 'Triton Gaming’s leads and above manage it; officers and recruits enter scores.';
  return {
    owner: division ? `Only ${division}` : 'Triton Gaming',
    lines: [
      manage,
      'Exec and admin can do everything.',
      isPublic
        ? 'Anyone can see the bracket on its public page and in the stream overlays once it is out of draft.'
        : 'It is hidden from the public page and the overlays until you make it public.',
      division ? 'It shows on the division’s Tournaments page, not the club’s.' : 'It shows on the club’s Tournaments page, not on a division’s.',
    ],
  };
}

/** An event. `audience` is the event's own setting: public, or UCSD students only. */
export function eventWho(division: string | null, audience: 'public' | 'ucsd_only' | string): WhoSees {
  return {
    owner: division ? `${division}` : 'Triton Gaming',
    lines: [
      audience === 'ucsd_only' ? 'Only signed-in UCSD students can get a ticket.' : 'Anyone can see the event page and get a ticket.',
      division ? `${division}’s Heads manage it. It is listed under the division as well as the club’s calendar.` : 'Triton Gaming’s event managers manage it.',
    ],
  };
}

/** The short note for under a page title: whose items the page lists. */
export function scopeNote(page: 'club' | 'division', divisionName?: string): string {
  return page === 'division'
    ? `Only ${divisionName ?? 'this division'} sees and runs what is here. The club’s and other divisions’ are on their own pages.`
    : 'Triton Gaming’s own, and each division’s when you may see it. The chip on each row says whose it is.';
}
