import { NextResponse, after } from 'next/server';
import { authorizeTrivia, broadcast, loadGame } from '@/lib/trivia/server';
import { GRACE_MS, cleanCode } from '@/lib/trivia/game';

export const dynamic = 'force-dynamic';

// A player's answer to the open question. The server decides everything, in one database call (trivia_submit_answer): whether the question is still open, how long it took, whether it is right and the
// points. The first answer counts; the call also holds off the host's reveal for its own length, so an answer is either counted in that reveal or told it is closed, never lost in between.
// The right answer never leaves the server until the host reveals it.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authorizeTrivia('play');
  if (auth.error) return auth.error;
  const code = cleanCode((await params).code);
  const b = await request.json().catch(() => ({}));
  const pos = Math.round(Number(b.pos)), q = Math.round(Number(b.q));
  const g = code ? await loadGame(auth.svc, code, 'id') : null;
  if (!g) return NextResponse.json({ error: 'There is no game with that code.' }, { status: 404 });
  if (!Number.isInteger(pos) || !Number.isInteger(q) || pos < 0 || pos > 3 || q < 0) return NextResponse.json({ error: 'Pick one of the answers.' }, { status: 400 });
  const { data, error } = await auth.svc.rpc('trivia_submit_answer', { p_game: g.id, p_user: auth.user.id, p_q: q, p_pos: pos, p_grace_ms: GRACE_MS });
  if (error) return NextResponse.json({ error: 'Couldn’t send that. Tap again.' }, { status: 503 });
  const r = data as { gone?: boolean; closed?: boolean; out?: boolean; bad?: boolean; first?: boolean; pos?: number; answered?: number; players?: number };
  if (r.gone) return NextResponse.json({ error: 'There is no game with that code.' }, { status: 404 });
  if (r.closed) return NextResponse.json({ error: 'Too late: that question is closed.', closed: true }, { status: 409 });
  if (r.out) return NextResponse.json({ error: 'You are not in this game.' }, { status: 403 });
  if (r.bad) return NextResponse.json({ error: 'Pick one of the answers.' }, { status: 400 });
  // Tell the screens how many have answered once the reply is on its way (so the phone is not kept waiting for it).
  if (r.first) after(() => broadcast(g.id, 'count', { answered: r.answered, q }));
  return NextResponse.json({ ok: true, pos: r.pos, ...(r.first ? {} : { again: true }) });
}
