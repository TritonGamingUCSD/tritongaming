// What the screens and the routes pass around. Nothing in `PublicState` gives away the right answer before the host reveals it.

export type GameStatus = 'lobby' | 'question' | 'reveal' | 'done';
export type PlayerStatus = 'in' | 'blocked' | 'removed';

export interface Placing { name: string; score: number; rank: number; right?: number }
/** What the end screen tells about the game as a whole. Each part is left out when there is nothing to say (no right answers, nobody with a streak). */
export interface EndStats {
  asked: number;                                          // questions that were asked
  accuracy: number | null;                                // percent of all answers that were right
  fastest?: { name: string; ms: number; q: number };      // the quickest right answer (q: question number)
  streak?: { name: string; n: number };                   // the longest run of right answers
  hardest?: { q: number; text: string; pct: number };     // the question the fewest got right
  easiest?: { q: number; text: string; pct: number };     // and the one the most got right
}
export interface PlayerResult { pos: number | null; ok: boolean; pts: number; rank: number; score: number; streak?: number }

// What a reveal shows (and, with `final`, what the end of the game shows: the podium and everyone's rank).
export interface Reveal {
  final?: boolean;
  correct?: number;                         // the right position (reveal only)
  counts?: number[];                        // how many chose each position (reveal only)
  top: Placing[];                           // top 5 after a question, top 3 at the end
  results: Record<string, PlayerResult>;    // by user id: how each person did (the last question; at the end, the final rank and score)
  of: number;                               // players in the game
  more?: Placing[];                         // the end only: places 4 to 10
  stats?: EndStats;                         // the end only: a few facts about the game
}

export interface PublicState {
  gameId: string;
  code: string;
  quiz: string;
  status: GameStatus;
  current: number;                          // index of the question on screen, -1 in the lobby
  total: number;                            // questions in this game (the quiz's number until the game starts)
  players: number;                          // people in (not blocked or removed)
  question?: { category?: string; text: string; choices: string[]; secs: number; startedAt: number; endsAt: number };
  answered?: number;
  reveal?: Reveal;
  now: number;                              // the server's clock when this was made, to line phones up with it
}

export interface LobbyPlayer { id: string; name: string; status: PlayerStatus; score: number }

export interface QuizRow { id: string; slug: string; name: string; per_game: number; block_winners: boolean; restricted: boolean; open_to_guests: boolean; locked: boolean; questions: number; ready: number; games: number; last_played: string | null; created_at: string }
export interface QuestionRow { id: string; sort: number; category: string; image: string; text: string; choices: string[]; correct: number }
