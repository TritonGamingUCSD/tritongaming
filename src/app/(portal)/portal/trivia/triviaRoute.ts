// Where you are in Trivia, as an address: /portal/trivia/<tab>/<detail>.
//   /portal/trivia/play            join a game and your past games        /portal/trivia/play/<code>    playing a game (the whole screen)
//   /portal/trivia/quizzes         the quizzes                            /portal/trivia/quizzes/<quiz> a quiz's questions and its games
//   /portal/trivia/games           every game's results                   /portal/trivia/games/<code>   one game's results
//   /portal/trivia/host/<code>     running a game (the whole screen)
// Playing is for everyone signed in; the quizzes, games and hosting are for officers and above (anyone else is taken to Play).

export type TriviaRoute =
  | { tab: 'play'; code: string | null }
  | { tab: 'quizzes'; quiz: string | null }
  | { tab: 'games'; code: string | null }
  | { tab: 'host'; code: string };

export function parseTriviaRoute(tab: string | undefined, subtab: string | undefined, canHost: boolean): TriviaRoute {
  const code = subtab?.trim().toUpperCase() || null;
  if (!canHost) return { tab: 'play', code: tab === 'play' ? code : null };
  switch (tab) {
    case 'play': return { tab: 'play', code };
    case 'games': return { tab: 'games', code };
    case 'host': return code ? { tab: 'host', code } : { tab: 'quizzes', quiz: null };
    case 'quizzes': default: return { tab: 'quizzes', quiz: tab === 'quizzes' ? subtab ?? null : null };
  }
}

export function triviaParams(r: TriviaRoute): { tab: string; subtab: string | null } {
  switch (r.tab) {
    case 'play': return { tab: 'play', subtab: r.code };
    case 'quizzes': return { tab: 'quizzes', subtab: r.quiz };
    case 'games': return { tab: 'games', subtab: r.code };
    case 'host': return { tab: 'host', subtab: r.code };
  }
}
