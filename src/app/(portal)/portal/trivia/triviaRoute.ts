// Where you are in Trivia, as an address: /portal/trivia/<tab>/<detail>.
//   /portal/trivia/play            join a game and your past games        /portal/trivia/play/<code>    playing a game (the whole screen)
//   /portal/trivia/quizzes         the quizzes                            /portal/trivia/quizzes/<quiz> a quiz's questions   /portal/trivia/quizzes/<quiz>/history its games (/games still works)   /portal/trivia/quizzes/<quiz>/<code>   one game's results
//   /portal/trivia/host/<code>     running a game (the whole screen)
// Playing is for everyone signed in; the quizzes, their games and hosting are for officers and above (anyone else is taken to Play).

export type TriviaRoute =
  { tab: 'play'; code: string | null } | { tab: 'quizzes'; quiz: string | null; view: 'questions' | 'games'; game: string | null } | { tab: 'host'; code: string };

export function parseTriviaRoute(tab: string | undefined, subtab: string | undefined, canHost: boolean, detail?: string): TriviaRoute {
  const code = subtab?.trim().toUpperCase() || null;
  if (!canHost) return { tab: 'play', code: tab === 'play' ? code : null };
  switch (tab) {
    case 'host':
      return code ? { tab: 'host', code } : { tab: 'quizzes', quiz: null, view: 'questions', game: null };
    case 'quizzes': {
      const d = detail?.trim().toUpperCase();
      return { tab: 'quizzes', quiz: subtab ?? null, view: subtab && d ? 'games' : 'questions', game: subtab && d && d !== 'GAMES' && d !== 'HISTORY' ? d : null };
    }
    case 'play':
    default:
      return { tab: 'play', code: tab === 'play' ? code : null }; // Play is the first tab and where Trivia opens
  }
}

export function triviaParams(r: TriviaRoute): { tab: string; subtab: string | null; detail: string | null } {
  switch (r.tab) {
    case 'play':
      return { tab: 'play', subtab: r.code, detail: null };
    case 'quizzes':
      return { tab: 'quizzes', subtab: r.quiz, detail: r.quiz && r.view === 'games' ? (r.game ?? 'history') : null };
    case 'host':
      return { tab: 'host', subtab: r.code, detail: null };
  }
}
