import type { SupabaseClient } from '@supabase/supabase-js';
import type { Match, Link } from './bracket';

// Reading and writing a tournament, with the service client. Rows use snake_case; the engine's Match uses scoreA/scoreB and a/b slots.
export type TournamentRow = {
  id: string;
  slug: string;
  name: string;
  game: string;
  description: string;
  division_id: string | null;
  event_id: string | null;
  format: 'single' | 'double' | 'roundrobin' | 'swiss' | 'points';
  entrant_type: 'solo' | 'team';
  team_size: number;
  best_of: number;
  third_place: boolean;
  swiss_rounds: number | null;
  max_entrants: number | null;
  status: 'draft' | 'registration' | 'live' | 'complete';
  is_public: boolean;
  signups_open: boolean;
  starts_at: string | null;
  overlay_token: string;
  settings: Record<string, unknown>;
  created_by: string | null;
};

export type EntrantRow = {
  id: string;
  tournament_id: string;
  user_id: string | null;
  name: string;
  seed: number | null;
  checked_in: boolean;
  dropped: boolean;
  members: { user_id?: string | null; name: string }[];
  claim_code: string | null;
};

export type MatchRow = {
  tournament_id: string;
  key: string;
  bracket: string;
  round: number;
  idx: number;
  a: string | null;
  b: string | null;
  score_a: number | null;
  score_b: number | null;
  winner: 'a' | 'b' | null;
  status: Match['status'] | 'live';
  win_to: Link | null;
  lose_to: Link | null;
  games: { a: number; b: number; map?: string; pick_a?: string; pick_b?: string }[];
  station: string | null;
};

export const toMatch = (r: MatchRow): Match => ({
  key: r.key,
  bracket: r.bracket as Match['bracket'],
  round: r.round,
  index: r.idx,
  a: r.a,
  b: r.b,
  scoreA: r.score_a,
  scoreB: r.score_b,
  winner: r.winner,
  status: r.status === 'live' ? 'ready' : r.status,
  winTo: r.win_to ?? undefined,
  loseTo: r.lose_to ?? undefined,
});

export const toRow = (tournamentId: string, m: Match, extra: Partial<Pick<MatchRow, 'games' | 'station'>> = {}): Omit<MatchRow, 'games' | 'station'> & Partial<MatchRow> => ({
  tournament_id: tournamentId,
  key: m.key,
  bracket: m.bracket,
  round: m.round,
  idx: m.index,
  a: m.a,
  b: m.b,
  score_a: m.scoreA,
  score_b: m.scoreB,
  winner: m.winner,
  status: m.status,
  win_to: m.winTo ?? null,
  lose_to: m.loseTo ?? null,
  ...extra,
});

export async function loadTournament(svc: SupabaseClient, idOrSlug: string) {
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug);
  const { data: t } = await svc
    .from('tournaments')
    .select('*')
    .eq(isId ? 'id' : 'slug', idOrSlug)
    .maybeSingle();
  if (!t) return null;
  const [{ data: entrants }, { data: matches }, { data: staff }] = await Promise.all([
    svc.from('tournament_entrants').select('*').eq('tournament_id', t.id).order('seed', { ascending: true, nullsFirst: false }).order('created_at'),
    svc.from('tournament_matches').select('*').eq('tournament_id', t.id),
    svc.from('tournament_staff').select('user_id').eq('tournament_id', t.id),
  ]);
  return {
    tournament: t as TournamentRow,
    entrants: (entrants ?? []) as EntrantRow[],
    matches: (matches ?? []) as MatchRow[],
    staff: (staff ?? []).map((s) => s.user_id as string),
  };
}

// Write back the matches that changed (only those whose result, sides or status differ from what is stored).
export async function saveMatches(svc: SupabaseClient, tournamentId: string, before: MatchRow[], after: Match[]) {
  const old = new Map(before.map((r) => [r.key, r]));
  const changed = after.filter((m) => {
    const o = old.get(m.key);
    return !o || o.a !== m.a || o.b !== m.b || o.score_a !== m.scoreA || o.score_b !== m.scoreB || o.winner !== m.winner || (o.status === 'live' ? 'ready' : o.status) !== m.status;
  });
  if (changed.length === 0) return;
  const rows = changed.map((m) => {
    const o = old.get(m.key);
    return { ...toRow(tournamentId, m, { games: o?.games ?? [], station: o?.station ?? null }), updated_at: new Date().toISOString() };
  });
  const { error } = await svc.from('tournament_matches').upsert(rows, { onConflict: 'tournament_id,key' });
  if (error) throw new Error('Could not save the matches.');
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'tournament'
  );
}
