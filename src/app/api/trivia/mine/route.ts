import { NextResponse } from 'next/server';
import { authorizeTrivia } from '@/lib/trivia/server';
import type { Reveal } from '@/lib/trivia/types';

export const dynamic = 'force-dynamic';

// The games a person has played (real ones; finished with their place, and any still running so they can get back in).
export async function GET() {
  const auth = await authorizeTrivia('play');
  if (auth.error) return auth.error;
  const { data: mine } = await auth.svc.from('trivia_players').select('game_id, status, score').eq('user_id', auth.user.id).order('joined_at', { ascending: false }).limit(60);
  const ids = (mine ?? []).map((m) => m.game_id as string);
  if (!ids.length) return NextResponse.json({ games: [] });
  const { data: games } = await auth.svc.from('trivia_games').select('id, code, status, created_at, reveal, trivia_quizzes(name)').in('id', ids);
  const by = new Map((mine ?? []).map((m) => [m.game_id as string, m]));
  const out = ((games ?? []) as unknown as { id: string; code: string; status: string; created_at: string; reveal: Reveal | null; trivia_quizzes: { name: string } | null }[])
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((g) => ({
      code: g.code,
      quiz: g.trivia_quizzes?.name ?? '',
      status: g.status,
      created_at: g.created_at,
      score: by.get(g.id)?.score ?? 0,
      rank: g.status === 'done' ? (g.reveal?.results?.[auth.user.id]?.rank ?? null) : null,
      of: g.status === 'done' ? (g.reveal?.of ?? null) : null,
      blocked: by.get(g.id)?.status === 'blocked',
    }));
  return NextResponse.json({ games: out });
}
