import { NextResponse } from 'next/server';
import { authorizeTrivia, findQuiz, publicState } from '@/lib/trivia/server';
import { createGame } from '@/lib/trivia/gameServer';

export const dynamic = 'force-dynamic';

// Games, newest first: the ones still running (so a host can get back to one) and the finished real ones with their top three.
export async function GET() {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const { data: games } = await auth.svc.from('trivia_games').select('id, code, status, practice, created_at, finished_at, per_game, plan, trivia_quizzes(name, slug)').or('practice.eq.false,status.neq.done').order('created_at', { ascending: false }).limit(100);
  const list = (games ?? []) as unknown as { id: string; code: string; status: string; practice: boolean; created_at: string; finished_at: string | null; per_game: number; plan: unknown[]; trivia_quizzes: { name: string; slug: string } | null }[];
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
    games: list.map((g) => ({
      code: g.code, status: g.status, practice: g.practice, created_at: g.created_at, finished_at: g.finished_at, quiz: g.trivia_quizzes?.name ?? '', quiz_slug: g.trivia_quizzes?.slug ?? '',
      questions: g.plan.length || g.per_game, players: count.get(g.id) ?? 0,
      winners: (winners.data ?? []).filter((w) => w.game_id === g.id).sort((a, b) => (a.rank as number) - (b.rank as number)).map((w) => ({ rank: w.rank as number, name: names.get(w.user_id as string) ?? 'Player' })),
    })),
  });
}

// Open a lobby for a quiz. `practice` games don't block anyone and aren't kept.
export async function POST(request: Request) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const quiz = typeof b.quiz === 'string' ? await findQuiz(auth.svc, b.quiz) : null;
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  const game = await createGame(auth.svc, quiz, auth.user.id, !!b.practice);
  if (!game) return NextResponse.json({ error: 'Couldn’t open a game. Try again.' }, { status: 500 });
  return NextResponse.json({ code: game.code, state: await publicState(auth.svc, game) }, { status: 201 });
}
