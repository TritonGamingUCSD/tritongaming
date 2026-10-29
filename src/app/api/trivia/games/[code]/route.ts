import { NextResponse } from 'next/server';
import { authorizeTrivia, broadcast, gameGate, loadGame, publicState } from '@/lib/trivia/server';
import { cleanCode, isAskable, type PoolQuestion } from '@/lib/trivia/game';
import { finishGame, nextQuestion, revealQuestion, startGame } from '@/lib/trivia/gameServer';
import { logAudit } from '@/lib/notifications/audit';
import type { LobbyPlayer } from '@/lib/trivia/types';

export const dynamic = 'force-dynamic';

const notFound = () => NextResponse.json({ error: 'That game is gone.' }, { status: 404 });

// The host's picture: the public state, everyone in the lobby (with the ones who are blocked or sent out, so they can be let back in), and how many questions the quiz can draw.
// With ?results=1 also the finished results: every player's place and, per question, how many chose each answer.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const code = cleanCode((await params).code);
  const g = code ? await loadGame(auth.svc, code) : null;
  if (!g) return notFound();
  {
    const lock = await gameGate(auth, g);
    if (lock) return lock;
  }
  const wantResults = new URL(request.url).searchParams.get('results') === '1';
  const [state, pl, pool, answers] = await Promise.all([
    publicState(auth.svc, g),
    auth.svc.from('trivia_players').select('user_id, name, status, score, time_ms').eq('game_id', g.id).order('joined_at').limit(500),
    g.status === 'lobby' ? auth.svc.from('trivia_questions').select('id, category, text, choices, correct').eq('quiz_id', g.quiz_id).limit(1000) : null,
    wantResults ? auth.svc.from('trivia_answers').select('user_id, q_index, pos, ok').eq('game_id', g.id).limit(20000) : null,
  ]);
  const players: LobbyPlayer[] = (pl.data ?? []).map((p) => ({
    id: p.user_id as string,
    name: p.name as string,
    status: p.status as LobbyPlayer['status'],
    score: p.score as number,
  }));
  // The pictures go only to the host's screen (by question number), never to the phones.
  const body: Record<string, unknown> = {
    state,
    images: g.plan.map((p) => p.image ?? ''),
    players,
    quizSlug: g.trivia_quizzes?.slug ?? '',
    blocks: !!g.trivia_quizzes?.block_winners,
    guests: !!g.trivia_quizzes?.open_to_guests,
    perGame: g.per_game,
    ready: pool ? ((pool.data ?? []) as PoolQuestion[]).filter(isAskable).length : null,
  };
  if (wantResults) {
    const rows = (answers?.data ?? []) as { user_id: string; q_index: number; pos: number; ok: boolean }[];
    body.results = {
      standings: (pl.data ?? [])
        .filter((p) => p.status === 'in')
        .sort((a, b) => (b.score as number) - (a.score as number) || (a.time_ms as number) - (b.time_ms as number))
        .map((p) => ({ id: p.user_id as string, name: p.name as string, score: p.score as number, time_ms: p.time_ms as number })),
      questions: g.plan.map((q, i) => ({
        text: q.text,
        choices: q.choices,
        correct: q.correct,
        counts: q.choices.map((_, pos) => rows.filter((r) => r.q_index === i && r.pos === pos).length),
      })),
    };
  }
  return NextResponse.json(body);
}

// What the host does: start (the number of questions is the quiz's own setting, copied to the game when it is opened), reveal the answer, go to the next question, end the game, and let someone back in or send them out.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const code = cleanCode((await params).code);
  const g = code ? await loadGame(auth.svc, code) : null;
  if (!g) return notFound();
  {
    const lock = await gameGate(auth, g);
    if (lock) return lock;
  }
  const b = await request.json().catch(() => ({}));
  const done = (r: unknown) => ('error' in (r as object) ? NextResponse.json({ error: (r as { error: string }).error }, { status: (r as { status: number }).status }) : null);
  switch (b.action) {
    case 'start': {
      const r = await startGame(auth.svc, g, g.per_game);
      return done(r) ?? NextResponse.json({ ok: true });
    }
    case 'reveal': {
      const r = await revealQuestion(auth.svc, g);
      return done(r) ?? NextResponse.json({ ok: true });
    }
    case 'next': {
      const r = await nextQuestion(auth.svc, g);
      return done(r) ?? NextResponse.json({ ok: true });
    }
    case 'end': {
      const r = await finishGame(auth.svc, g);
      return done(r) ?? NextResponse.json({ ok: true });
    }
    case 'allow':
    case 'remove': {
      if (typeof b.user_id !== 'string') return NextResponse.json({ error: 'Not found.' }, { status: 404 });
      const { data } = await auth.svc
        .from('trivia_players')
        .update({ status: b.action === 'allow' ? 'in' : 'removed' })
        .eq('game_id', g.id)
        .eq('user_id', b.user_id)
        .select('user_id')
        .maybeSingle();
      if (!data) return NextResponse.json({ error: 'That player isn’t in this game.' }, { status: 404 });
      await broadcast(g.id, 'players', await publicState(auth.svc, g), true);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
}

// Delete a game and its results (the top three of a deleted game are free to play that quiz again).
export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const code = cleanCode((await params).code);
  const g = code ? await loadGame(auth.svc, code) : null;
  if (!g) return notFound();
  {
    const lock = await gameGate(auth, g);
    if (lock) return lock;
  }
  if (g.status !== 'done' && g.status !== 'lobby') return NextResponse.json({ error: 'End the game first.' }, { status: 409 });
  await auth.svc.from('trivia_games').delete().eq('id', g.id);
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'remove',
    entityType: 'trivia game',
    entityId: g.id,
    summary: `Deleted the Trivia game of “${g.trivia_quizzes?.name ?? 'a quiz'}” (${g.code})`,
  });
  await broadcast(g.id, 'gone', {});
  return NextResponse.json({ ok: true });
}
