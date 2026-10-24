// What the screens and the routes pass around. Nothing in `PublicState` gives away the right answer before the host reveals it.

export type GameStatus = 'lobby' | 'question' | 'reveal' | 'done';
export type PlayerStatus = 'in' | 'blocked' | 'removed';

export interface Placing { name: string; score: number; rank: number }
export interface PlayerResult { pos: number | null; ok: boolean; pts: number; rank: number; score: number; streak?: number }

// What a reveal shows (and, with `final`, what the end of the game shows: the podium and everyone's rank).
export interface Reveal {
  final?: boolean;
  correct?: number;                         // the right position (reveal only)
  counts?: number[];                        // how many chose each position (reveal only)
  top: Placing[];                           // top 5 after a question, top 3 at the end
  results: Record<string, PlayerResult>;    // by user id: how each person did (the last question; at the end, the final rank and score)
  of: number;                               // players in the game
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

export interface QuizRow { id: string; slug: string; name: string; per_game: number; block_winners: boolean; restricted: boolean; locked: boolean; questions: number; ready: number; games: number; last_played: string | null; created_at: string }
export interface QuestionRow { id: string; sort: number; category: string; image: string; text: string; choices: string[]; correct: number }
