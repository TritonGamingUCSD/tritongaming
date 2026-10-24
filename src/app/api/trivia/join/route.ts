import { NextResponse } from 'next/server';
import { authorizeTrivia, broadcast, displayName, loadGame, publicState } from '@/lib/trivia/server';
import { cleanCode } from '@/lib/trivia/game';

export const dynamic = 'force-dynamic';

// Join a game with its code (typed, or from the QR code). Coming back into a game you are already in just returns where it is, with your score. The top three of an earlier game of the same quiz
// are put on the host's list instead of in: the host can let them in.
export async function POST(request: Request) {
  const auth = await authorizeTrivia('play');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const code = typeof b.code === 'string' ? cleanCode(b.code) : null;
  const g = code ? await loadGame(auth.svc, code) : null;
  if (!g) return NextResponse.json({ error: 'There is no game with that code.' }, { status: 404 });
  const { data: mine } = await auth.svc.from('trivia_players').select('status, score').eq('game_id', g.id).eq('user_id', auth.user.id).maybeSingle();
  let me = mine as { status: string; score: number } | null;
  if (!me) {
    if (g.status === 'done') return NextResponse.json({ error: 'That game is already over.' }, { status: 409 });
    const barred = !g.practice && ((await auth.svc.from('trivia_winners').select('user_id', { count: 'exact', head: true }).eq('quiz_id', g.quiz_id).eq('user_id', auth.user.id)).count ?? 0) > 0;
    const status = barred ? 'blocked' : 'in';
    const { error } = await auth.svc.from('trivia_players').upsert({ game_id: g.id, user_id: auth.user.id, name: await displayName(auth.svc, auth.user.id), status }, { onConflict: 'game_id,user_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Couldn’t join. Try again.' }, { status: 500 });
    me = { status, score: 0 };
    const state = await publicState(auth.svc, g);
    await broadcast(g.id, 'players', state);
    return NextResponse.json({ state, me });
  }
  return NextResponse.json({ state: await publicState(auth.svc, g), me });
}
