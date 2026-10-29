import { NextResponse } from 'next/server';
import { authorizeTrivia, broadcast, displayName, loadGame, publicState } from '@/lib/trivia/server';
import { cleanCode } from '@/lib/trivia/game';

// A guest's nickname: trimmed, spaces squeezed, no control characters, at most 20 characters.
const cleanNick = (v: unknown) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20)
    : '';

export const dynamic = 'force-dynamic';

// Join a game with its code (typed, or from the QR code). Coming back into a game you are already in just returns where it is, with your score. The top three of an earlier game of the same quiz
// are put on the host's list instead of in: the host can let them in. A guest (no account) may only join a quiz that is open to guests, with a nickname, and is never held back by the top 3 rule.
export async function POST(request: Request) {
  const auth = await authorizeTrivia('play');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const code = typeof b.code === 'string' ? cleanCode(b.code) : null;
  const g = code ? await loadGame(auth.svc, code) : null;
  if (!g) return NextResponse.json({ error: 'There is no game with that code.' }, { status: 404 });
  if (auth.guest && !g.trivia_quizzes?.open_to_guests) return NextResponse.json({ error: 'This game is for members. Sign in to play.', members: true }, { status: 403 });
  const { data: mine } = await auth.svc.from('trivia_players').select('status, score').eq('game_id', g.id).eq('user_id', auth.user.id).maybeSingle();
  let me = mine as { status: string; score: number } | null;
  if (!me) {
    if (g.status === 'done') return NextResponse.json({ error: 'That game is already over.' }, { status: 409 });
    let name = '';
    if (auth.guest) {
      name = cleanNick(b.nickname);
      if (name.length < 2) return NextResponse.json({ error: 'Pick a nickname (2 to 20 characters).', nickname: true }, { status: 400 });
      // The same nickname twice in a game gets a number, so players can tell each other apart.
      const { data: taken } = await auth.svc.from('trivia_players').select('name').eq('game_id', g.id).limit(1000);
      const used = new Set((taken ?? []).map((p) => (p.name as string).toLowerCase()));
      let n = 1,
        tryName = name;
      while (used.has(tryName.toLowerCase())) {
        n++;
        tryName = `${name.slice(0, 17)} ${n}`;
      }
      name = tryName;
    } else name = await displayName(auth.svc, auth.user.id);
    const barred =
      !auth.guest &&
      !!g.trivia_quizzes?.block_winners &&
      ((await auth.svc.from('trivia_winners').select('user_id', { count: 'exact', head: true }).eq('quiz_id', g.quiz_id).eq('user_id', auth.user.id)).count ?? 0) > 0;
    const status = barred ? 'blocked' : 'in';
    const { error } = await auth.svc
      .from('trivia_players')
      .upsert({ game_id: g.id, user_id: auth.user.id, name, status }, { onConflict: 'game_id,user_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Couldn’t join. Try again.' }, { status: 500 });
    me = { status, score: 0 };
    const state = await publicState(auth.svc, g);
    await broadcast(g.id, 'players', state, true); // only the host's screen follows who joins
    return NextResponse.json({ state, me });
  }
  return NextResponse.json({ state: await publicState(auth.svc, g), me });
}
