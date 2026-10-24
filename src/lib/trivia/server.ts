import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import type { PlannedQuestion } from './game';
import type { GameStatus, PublicState, Reveal } from './types';

export const UUID = /^[0-9a-f-]{36}$/i;
export const GAME_COLUMNS = 'id, quiz_id, code, host_id, practice, status, per_game, plan, current, q_started_at, q_ends_at, reveal, created_at, finished_at';

export interface GameRow {
  id: string; quiz_id: string; code: string; host_id: string | null; practice: boolean; status: GameStatus; per_game: number; plan: PlannedQuestion[];
  current: number; q_started_at: string | null; q_ends_at: string | null; reveal: Reveal | null; created_at: string; finished_at: string | null;
  trivia_quizzes?: { name: string; slug: string } | null;
}

// Who may do what: 'host' (officers and above: write quizzes, host games, see every result) or 'play' (anyone signed in).
export async function authorizeTrivia(mode: 'host' | 'play') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  const canHost = hasCapability(grants, 'host_trivia');
  if (mode === 'host' && !canHost) return { error: NextResponse.json({ error: 'Hosting Trivia is for officers and above.' }, { status: 403 }) };
  return { user, svc, canHost };
}

export async function displayName(svc: SupabaseClient, userId: string): Promise<string> {
  const { data } = await svc.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  return ((data?.display_name as string | null) ?? '').trim() || 'Player';
}

// A game by its code. `'id'` reads only the id (what taking an answer needs). A database failure throws (so the caller answers with a 500 the screen retries) instead of looking like "no such game".
export async function loadGame(svc: SupabaseClient, code: string): Promise<GameRow | null>;
export async function loadGame(svc: SupabaseClient, code: string, only: 'id'): Promise<{ id: string } | null>;
export async function loadGame(svc: SupabaseClient, code: string, only?: 'id'): Promise<GameRow | { id: string } | null> {
  const { data, error } = await svc.from('trivia_games').select(only ? 'id' : `${GAME_COLUMNS}, trivia_quizzes(name, slug)`).eq('code', code).maybeSingle();
  if (error) throw new Error(`trivia game read failed: ${error.message}`);
  return (data as unknown as GameRow | { id: string } | null) ?? null;
}

// Tell every screen of a game something changed. The payload is the same small public state a screen would otherwise ask for, so no screen has to read the database to follow along.
// Failing to send is fine: the screens also ask now and then, so a missed message only means they catch up a few seconds later.
export async function broadcast(gameId: string, event: string, payload: unknown): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic: `trivia:${gameId}`, event, payload, private: false }] }),
    });
  } catch { /* the screens catch up on their own */ }
}

// The public picture of a game right now. In a question only the question and its answers (no right one); the reveal and the end carry what was decided.
export async function publicState(svc: SupabaseClient, g: GameRow): Promise<PublicState> {
  const [players, answered] = await Promise.all([
    svc.from('trivia_players').select('user_id', { count: 'exact', head: true }).eq('game_id', g.id).eq('status', 'in'),
    g.status === 'question' ? svc.from('trivia_answers').select('user_id', { count: 'exact', head: true }).eq('game_id', g.id).eq('q_index', g.current) : null,
  ]);
  return stateOf(g, players.count ?? 0, answered?.count ?? undefined);
}

export function stateOf(g: GameRow, players: number, answered?: number): PublicState {
  const q = g.plan[g.current];
  const shown = (g.status === 'question' || g.status === 'reveal') && q && g.q_started_at && g.q_ends_at;
  return {
    gameId: g.id, code: g.code, quiz: g.trivia_quizzes?.name ?? '', practice: g.practice, status: g.status,
    current: g.current, total: g.plan.length || g.per_game, players,
    question: shown ? { text: q.text, choices: q.choices, secs: q.secs, startedAt: Date.parse(g.q_started_at!), endsAt: Date.parse(g.q_ends_at!) } : undefined,
    answered: g.status === 'question' ? answered ?? 0 : undefined,
    reveal: g.status === 'reveal' || g.status === 'done' ? g.reveal ?? undefined : undefined,
    now: Date.now(),
  };
}

// A quiz by its address (the slug) or its id.
export async function findQuiz(svc: SupabaseClient, idOrSlug: string): Promise<{ id: string; slug: string; name: string; per_game: number; created_at: string } | null> {
  const col = UUID.test(idOrSlug) ? 'id' : 'slug';
  const { data } = await svc.from('trivia_quizzes').select('id, slug, name, per_game, created_at').eq(col, idOrSlug).maybeSingle();
  return data as { id: string; slug: string; name: string; per_game: number; created_at: string } | null;
}
