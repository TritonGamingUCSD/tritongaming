import { NextResponse } from 'next/server';
import { authorizeTrivia, findQuiz, lockedQuizIds, publicState, quizGate } from '@/lib/trivia/server';
import { createGame } from '@/lib/trivia/gameServer';

export const dynamic = 'force-dynamic';
const PAGE = 20;

// Games, newest first: the ones still running (so a host can get back to one) and the finished ones with their top three. `?quiz=<slug>` is one quiz's games, `?live=1` only the running ones.
// A quiz's games come PAGE at a time: `?before=<created_at of the last one shown>` asks for the next page and `more` says whether there is one. Games of quizzes shared with other officers are left out.
export async function GET(request: Request) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const q = new URL(request.url).searchParams;
  const live = q.get('live') === '1';
  const before = q.get('before');
  let query = auth.svc.from('trivia_games').select('id, code, status, created_at, finished_at, per_game, plan, trivia_quizzes(name, slug)').order('created_at', { ascending: false }).limit(live ? 100 : PAGE + 1);
  if (live) query = query.neq('status', 'done');   // only the games still running, across every quiz
  if (before && !Number.isNaN(Date.parse(before))) query = query.lt('created_at', before);
  const slug = q.get('quiz');
  if (slug) {
    const quiz = await findQuiz(auth.svc, slug);
    if (!quiz) return NextResponse.json({ games: [], more: false });
    const lock = await quizGate(auth, quiz);
    if (lock) return lock;
    query = query.eq('quiz_id', quiz.id);
  } else {
    const locked = await lockedQuizIds(auth);
    if (locked.length) query = query.not('quiz_id', 'in', `(${locked.join(',')})`);
  }
  const { data: games } = await query;
  const more = !live && (games ?? []).length > PAGE;
  const list = (more ? (games ?? []).slice(0, PAGE) : (games ?? [])) as unknown as { id: string; code: string; status: string; created_at: string; finished_at: string | null; per_game: number; plan: unknown[]; trivia_quizzes: { name: string; slug: string } | null }[];
  const ids = list.map((g) => g.id);
  const [players, winners] = ids.length ? await Promise.all([
    auth.svc.from('trivia_players').select('game_id').in('game_id', ids).eq('status', 'in').limit(10000),
    auth.svc.from('trivia_winners').select('game_id, rank, user_id').in('game_id', ids).limit(1000),
  ]) : [{ data: [] }, { data: [] }];
  const names = new Map<string, string>();
  const wIds = [...new Set((winners.data ?? []).map((w) => w.user_id as string))];
  if (wIds.length) for (const p of (await auth.svc.from('profiles').select('id, display_name').in('id', wIds)).data ?? []) names.set(p.id as string, (p.display_name as string | null) || 'Player');
  const count = new Map<string, number>();
  for (const p of players.data ?? []) count.set(p.game_id as string, (count.get(p.game_id as string) ?? 0) + 1);
  return NextResponse.json({
    more,
    games: list.map((g) => ({
      code: g.code, status: g.status, created_at: g.created_at, finished_at: g.finished_at, quiz: g.trivia_quizzes?.name ?? '', quiz_slug: g.trivia_quizzes?.slug ?? '',
      questions: g.plan.length || g.per_game, players: count.get(g.id) ?? 0,
      winners: (winners.data ?? []).filter((w) => w.game_id === g.id).sort((a, b) => (a.rank as number) - (b.rank as number)).map((w) => ({ rank: w.rank as number, name: names.get(w.user_id as string) ?? 'Player' })),
    })),
  });
}

// Open a lobby for a quiz.
export async function POST(request: Request) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const quiz = typeof b.quiz === 'string' ? await findQuiz(auth.svc, b.quiz) : null;
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  { const lock = await quizGate(auth, quiz); if (lock) return lock; }
  // Hosting a quiz that already has a lobby open (its host screen was left, not closed) opens that lobby again instead of making another one.
  const { data: open } = await auth.svc.from('trivia_games').select('code').eq('quiz_id', quiz.id).eq('status', 'lobby').gt('created_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString()).order('created_at', { ascending: false }).limit(1);
  if (open?.[0]) return NextResponse.json({ code: open[0].code as string, reused: true }, { status: 200 });
  const game = await createGame(auth.svc, quiz, auth.user.id);
  if (!game) return NextResponse.json({ error: 'Couldn’t open a game. Try again.' }, { status: 500 });
  return NextResponse.json({ code: game.code, state: await publicState(auth.svc, game) }, { status: 201 });
}
