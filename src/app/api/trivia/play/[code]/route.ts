import { NextResponse } from 'next/server';
import { authorizeTrivia, loadGame, publicState } from '@/lib/trivia/server';
import { cleanCode } from '@/lib/trivia/game';

export const dynamic = 'force-dynamic';

// A player's picture of the game: the public state, who they are in it (in, blocked or sent out), and what they already answered on the open question. Screens ask for this when they open, when
// the phone wakes up, and every few seconds as a back-up to the live messages.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await authorizeTrivia('play');
  if (auth.error) return auth.error;
  const code = cleanCode((await params).code);
  const g = code ? await loadGame(auth.svc, code) : null;
  if (!g) return NextResponse.json({ error: 'There is no game with that code.' }, { status: 404 });
  const [state, mine, answer] = await Promise.all([
    publicState(auth.svc, g),
    auth.svc.from('trivia_players').select('status, score').eq('game_id', g.id).eq('user_id', auth.user.id).maybeSingle(),
    g.status === 'question' ? auth.svc.from('trivia_answers').select('pos').eq('game_id', g.id).eq('user_id', auth.user.id).eq('q_index', g.current).maybeSingle() : null,
  ]);
  if (!mine.data) return NextResponse.json({ error: 'You haven’t joined this game.', joined: false }, { status: 404 });
  return NextResponse.json({ state, me: { ...mine.data, userId: auth.user.id, answered: (answer?.data?.pos as number | undefined) ?? null } });
}
