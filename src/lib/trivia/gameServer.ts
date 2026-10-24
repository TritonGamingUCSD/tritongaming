import type { SupabaseClient } from '@supabase/supabase-js';
import { CARD_MS, drawGame, isAskable, makeCode, standings, topThree, totals, type PoolQuestion } from './game';
import { GAME_COLUMNS, broadcast, publicState, stateOf, type GameRow } from './server';
import type { PlayerResult, Reveal } from './types';

const SELECT = `${GAME_COLUMNS}, trivia_quizzes(name, slug)`;
const asGame = (d: unknown) => d as GameRow;

// A lobby nobody opened a game from for hours is left over from a screen that was closed: clear those whenever a new game is made.
async function clearStaleLobbies(svc: SupabaseClient) {
  await svc.from('trivia_games').delete().eq('status', 'lobby').lt('created_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString());
}

export async function createGame(svc: SupabaseClient, quiz: { id: string; per_game: number }, hostId: string): Promise<GameRow | null> {
  await clearStaleLobbies(svc);
  for (let i = 0; i < 8; i++) {
    const { data, error } = await svc.from('trivia_games').insert({ quiz_id: quiz.id, code: makeCode(), host_id: hostId, per_game: quiz.per_game }).select(SELECT).single();
    if (data) return asGame(data);
    if (error && error.code !== '23505') return null;   // anything but a code clash is a real failure
  }
  return null;
}

async function setPlayerTotals(svc: SupabaseClient, gameId: string, rows: { user_id: string; name: string; score: number; time_ms: number }[]) {
  if (rows.length) await svc.from('trivia_players').upsert(rows.map((r) => ({ game_id: gameId, user_id: r.user_id, name: r.name, score: r.score, time_ms: r.time_ms })), { onConflict: 'game_id,user_id' });
}

// Where everyone stands: scores from all the answers so far, for the players still in.
async function standingsNow(svc: SupabaseClient, gameId: string) {
  const [pl, an] = await Promise.all([
    svc.from('trivia_players').select('user_id, name').eq('game_id', gameId).eq('status', 'in').limit(500),
    svc.from('trivia_answers').select('user_id, q_index, pos, ok, ms, points').eq('game_id', gameId).limit(20000),
  ]);
  const answers = (an.data ?? []) as { user_id: string; q_index: number; pos: number; ok: boolean; ms: number; points: number }[];
  const list = standings(totals((pl.data ?? []) as { user_id: string; name: string }[], answers));
  return { list, answers };
}

const OPEN = (g: GameRow, index: number) => {
  const q = g.plan[index];
  const now = Date.now();
  const start = now + (q.category ? CARD_MS : 0);   // a question with a category opens on its category card first; the clock starts after it
  return { status: 'question', current: index, q_started_at: new Date(start).toISOString(), q_ends_at: new Date(start + q.secs * 1000).toISOString(), reveal: null };
};

async function save(svc: SupabaseClient, g: GameRow, from: GameRow['status'], patch: Record<string, unknown>): Promise<GameRow | null> {
  const { data } = await svc.from('trivia_games').update(patch).eq('id', g.id).eq('status', from).select(SELECT).maybeSingle();   // the status check stops a double click moving it twice
  return data ? asGame(data) : null;
}

async function push(svc: SupabaseClient, g: GameRow) {
  await broadcast(g.id, 'state', await publicState(svc, g));
}

/** Draw the questions and put the first one up. */
export async function startGame(svc: SupabaseClient, g: GameRow, count: number): Promise<GameRow | { error: string; status: number }> {
  if (g.status !== 'lobby') return { error: 'That game already started.', status: 409 };
  const [pool, used, inCount] = await Promise.all([
    svc.from('trivia_questions').select('id, text, choices, correct, category').eq('quiz_id', g.quiz_id).order('sort').limit(1000),
    svc.from('trivia_games').select('plan').eq('quiz_id', g.quiz_id).neq('id', g.id).limit(500),
    svc.from('trivia_players').select('user_id', { count: 'exact', head: true }).eq('game_id', g.id).eq('status', 'in'),
  ]);
  if (!inCount.count) return { error: 'Nobody has joined yet.', status: 409 };
  const usedIds = new Set<string>();
  for (const r of used.data ?? []) for (const q of (r.plan ?? []) as { id: string }[]) usedIds.add(q.id);
  const rows = (pool.data ?? []) as PoolQuestion[];
  const ready = rows.filter(isAskable).length;
  if (!ready) return { error: 'This quiz has no finished questions yet: each needs text, four answers and a right answer.', status: 409 };
  const plan = drawGame(rows, usedIds, Math.min(Math.max(1, count), ready));
  const next = await save(svc, g, 'lobby', { plan, per_game: plan.length, ...OPEN({ ...g, plan }, 0) });
  if (!next) return { error: 'That game already started.', status: 409 };
  await push(svc, next);
  return next;
}

/** Close the question: score it, and show the answer, how many chose what, and the top five. */
export async function revealQuestion(svc: SupabaseClient, g: GameRow): Promise<GameRow | { error: string; status: number }> {
  if (g.status !== 'question') return { error: 'There is no open question.', status: 409 };
  // Close the question FIRST: an answer being taken at this moment finishes before this goes through (see trivia_submit_answer), and any later one is refused. Only then are the scores counted,
  // so every answer that was accepted is in them.
  const closed = await save(svc, g, 'question', { status: 'reveal' });
  if (!closed) return { error: 'That question was already revealed.', status: 409 };
  const { list, answers } = await standingsNow(svc, g.id);
  const q = g.plan[g.current];
  const counts = q.choices.map((_, pos) => answers.filter((a) => a.q_index === g.current && a.pos === pos).length);
  const results: Record<string, PlayerResult> = {};
  for (const p of list) {
    const a = answers.find((x) => x.q_index === g.current && x.user_id === p.user_id);
    let streak = 0;   // right answers in a row, ending with this question
    for (let i = g.current; i >= 0 && answers.some((x) => x.q_index === i && x.user_id === p.user_id && x.ok); i--) streak++;
    results[p.user_id] = { pos: a?.pos ?? null, ok: !!a?.ok, pts: a?.points ?? 0, rank: p.rank, score: p.score, streak };
  }
  const reveal: Reveal = { correct: q.correct, counts, top: list.slice(0, 5).map((p) => ({ name: p.name, score: p.score, rank: p.rank })), results, of: list.length };
  const next = await save(svc, closed, 'reveal', { reveal });
  if (!next) return { error: 'That question was already revealed.', status: 409 };
  await setPlayerTotals(svc, g.id, list);
  await push(svc, next);
  return next;
}

/** After the last question (or when the host ends the game early): the podium, and the top three are barred from this quiz's next games. */
export async function finishGame(svc: SupabaseClient, g: GameRow): Promise<GameRow | { error: string; status: number }> {
  if (g.status === 'done') return { error: 'That game is over.', status: 409 };
  // Over first, then the final scores are counted (the same order as a reveal: no answer can be stored after it, none is left out).
  const over = await save(svc, g, g.status, { status: 'done', finished_at: new Date().toISOString() });
  if (!over) return { error: 'That game is over.', status: 409 };
  const { list } = await standingsNow(svc, g.id);
  const results: Record<string, PlayerResult> = {};
  for (const p of list) results[p.user_id] = { pos: null, ok: false, pts: 0, rank: p.rank, score: p.score };
  const reveal: Reveal = { final: true, top: topThree(list).map((p) => ({ name: p.name, score: p.score, rank: p.rank })), results, of: list.length };   // nobody on zero is on the podium
  const next = await save(svc, over, 'done', { reveal });
  if (!next) return { error: 'That game is over.', status: 409 };
  await setPlayerTotals(svc, g.id, list);
  await svc.from('trivia_winners').delete().eq('game_id', g.id);
  if (g.trivia_quizzes?.block_winners) {   // the quiz's setting: its top three can't join the next game of this quiz
    const winners = topThree(list);
    if (winners.length) await svc.from('trivia_winners').insert(winners.map((w, i) => ({ game_id: g.id, quiz_id: g.quiz_id, user_id: w.user_id, rank: Math.min(3, i + 1) })));
  }
  await push(svc, next);
  return next;
}

/** From a reveal: the next question, or the end after the last one. */
export async function nextQuestion(svc: SupabaseClient, g: GameRow): Promise<GameRow | { error: string; status: number }> {
  if (g.status !== 'reveal') return { error: 'Reveal the answer first.', status: 409 };
  if (g.current + 1 >= g.plan.length) return finishGame(svc, g);
  const next = await save(svc, g, 'reveal', OPEN(g, g.current + 1));
  if (!next) return { error: 'That question is already up.', status: 409 };
  await push(svc, next);
  return next;
}

export { stateOf };
