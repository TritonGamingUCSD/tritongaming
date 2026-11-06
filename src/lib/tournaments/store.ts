import type { SupabaseClient } from '@supabase/supabase-js';
import type { Match, Link } from './bracket';
import type { Advance, StageFormat, StageSettings } from './stages';

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

export type StageRow = {
  id: string;
  tournament_id: string;
  position: number;
  name: string;
  format: StageFormat;
  settings: StageSettings;
  advance: Advance;
  status: 'pending' | 'live' | 'complete';
};
export type StageEntrantRow = { stage_id: string; entrant_id: string; seed: number; group_no: number | null };

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
  stage_id: string | null;
  group_no: number | null;
  label: string | null;
  best_of: number | null;
  scheduled_at: string | null;
  heat: { entrant_id: string; placement: number; points: number }[] | null;
};

// A match's key in the database starts with its stage ("s1/W2-3") so keys never collide between stages; the engine knows only the part after the slash.
export const stageKey = (position: number, key: string) => `s${position}/${key}`;
export const engineKey = (dbKey: string) => dbKey.replace(/^s\d+\//, '');
const unlink = (l: Link | null): Link | undefined => (l ? { ...l, key: engineKey(l.key) } : undefined);
export const toMatch = (r: MatchRow): Match => ({
  key: engineKey(r.key),
  group: r.group_no ?? undefined,
  bracket: r.bracket as Match['bracket'],
  round: r.round,
  index: r.idx,
  a: r.a,
  b: r.b,
  scoreA: r.score_a,
  scoreB: r.score_b,
  winner: r.winner,
  status: r.status === 'live' ? 'ready' : r.status,
  winTo: unlink(r.win_to),
  loseTo: unlink(r.lose_to),
});

const relink = (position: number, l: Link | undefined): Link | null => (l ? { ...l, key: stageKey(position, l.key) } : null);
export const toRow = (
  tournamentId: string,
  stage: Pick<StageRow, 'id' | 'position'>,
  m: Match,
  extra: { games?: MatchRow['games']; station?: string | null; best_of?: number | null; label?: string | null } = {},
) => ({
  tournament_id: tournamentId,
  stage_id: stage.id,
  group_no: m.group ?? null,
  key: stageKey(stage.position, m.key),
  bracket: m.bracket,
  round: m.round,
  idx: m.index,
  a: m.a,
  b: m.b,
  score_a: m.scoreA,
  score_b: m.scoreB,
  winner: m.winner,
  status: m.status,
  win_to: relink(stage.position, m.winTo),
  lose_to: relink(stage.position, m.loseTo),
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
  const [{ data: entrants }, { data: matches }, { data: staff }, { data: stages }, { data: stageEntrants }] = await Promise.all([
    svc.from('tournament_entrants').select('*').eq('tournament_id', t.id).order('seed', { ascending: true, nullsFirst: false }).order('created_at'),
    svc.from('tournament_matches').select('*').eq('tournament_id', t.id),
    svc.from('tournament_staff').select('user_id').eq('tournament_id', t.id),
    svc.from('tournament_stages').select('*').eq('tournament_id', t.id).order('position'),
    svc.from('tournament_stage_entrants').select('stage_id, entrant_id, seed, group_no'),
  ]);
  const stageIds = new Set((stages ?? []).map((x) => x.id as string));
  return {
    tournament: t as TournamentRow,
    entrants: (entrants ?? []) as EntrantRow[],
    matches: (matches ?? []) as MatchRow[],
    staff: (staff ?? []).map((s) => s.user_id as string),
    stages: (stages ?? []) as StageRow[],
    stageEntrants: ((stageEntrants ?? []) as StageEntrantRow[]).filter((x) => stageIds.has(x.stage_id)),
  };
}

// Write back the matches of one stage that changed (only those whose result, sides or status differ from what is stored).
export async function saveMatches(svc: SupabaseClient, tournamentId: string, stage: Pick<StageRow, 'id' | 'position'>, before: MatchRow[], after: Match[]) {
  const old = new Map(before.map((r) => [engineKey(r.key), r]));
  const changed = after.filter((m) => {
    const o = old.get(m.key);
    return !o || o.a !== m.a || o.b !== m.b || o.score_a !== m.scoreA || o.score_b !== m.scoreB || o.winner !== m.winner || (o.status === 'live' ? 'ready' : o.status) !== m.status;
  });
  if (changed.length === 0) return;
  const rows = changed.map((m) => {
    const o = old.get(m.key);
    return {
      ...toRow(tournamentId, stage, m, { games: o?.games ?? [], station: o?.station ?? null, best_of: o?.best_of ?? null, label: o?.label ?? null }),
      updated_at: new Date().toISOString(),
    };
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
