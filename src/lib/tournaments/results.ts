import type { SupabaseClient } from '@supabase/supabase-js';
import { rank, stageRanking } from './stages';
import { pointsStandings, type HeatSlot } from './points';
import { defOf, stageEngineMatches, stageField } from './run';
import { loadTournament } from './store';

// Final places of a finished tournament, from its last stage: elimination placements, round robin or Swiss standings, or points totals. Equal places are shared where the format says so.
export function finalPlaces(data: NonNullable<Awaited<ReturnType<typeof loadTournament>>>): { entrantId: string; place: number }[] {
  const last = data.stages[data.stages.length - 1];
  if (!last) return [];
  const field = stageField(data.stages, last, data.entrants, data.matches, data.stageEntrants);
  const def = defOf(last);
  if (def.format === 'points')
    return pointsStandings(
      field.map((e) => e.id),
      data.matches.filter((m) => m.stage_id === last.id).map((m) => (m.heat ?? []) as HeatSlot[]),
    ).map((r, i) => ({ entrantId: r.id, place: i + 1 }));
  const engine = stageEngineMatches(data.matches, last);
  if (def.format === 'swiss' || def.format === 'custom')
    return rank(
      field.map((e) => e.id),
      engine,
      def.settings,
      new Map(field.map((e) => [e.id, e.seed])),
    ).map((r, i) => ({ entrantId: r.id, place: i + 1 }));
  return stageRanking(def, field, engine).map((r) => ({ entrantId: r.id, place: r.place }));
}

/** What a finish is worth on the leaderboard: 1st 10, 2nd 6, 3rd 4, 4th 3, 5th to 8th 2, everyone else who played 1. */
export const placementPoints = (place: number): number => (place === 1 ? 10 : place === 2 ? 6 : place === 3 ? 4 : place === 4 ? 3 : place <= 8 ? 2 : 1);

export interface LeaderRow {
  key: string;
  name: string;
  points: number;
  titles: number;
  podiums: number;
  played: number;
}

// The leaderboard over finished, public tournaments (optionally one division's): people with an account are one row across tournaments, guests are a row each by the name they played under.
export async function getLeaderboard(svc: SupabaseClient, opts: { divisionId?: string | null; limit?: number } = {}): Promise<LeaderRow[]> {
  let q = svc.from('tournaments').select('id').eq('status', 'complete').eq('is_public', true).order('created_at', { ascending: false }).limit(40);
  if (opts.divisionId) q = q.eq('division_id', opts.divisionId);
  else if (opts.divisionId === null) q = q.is('division_id', null);
  const { data: ids } = await q;
  const rows = new Map<string, LeaderRow>();
  for (const { id } of ids ?? []) {
    const data = await loadTournament(svc, id as string);
    if (!data) continue;
    const names = new Map(data.entrants.map((e) => [e.id, e]));
    for (const { entrantId, place } of finalPlaces(data)) {
      const e = names.get(entrantId);
      if (!e) continue;
      const key = e.user_id ? `u:${e.user_id}` : `n:${e.name.toLowerCase()}`;
      const r = rows.get(key) ?? { key, name: e.name, points: 0, titles: 0, podiums: 0, played: 0 };
      r.points += placementPoints(place);
      r.played++;
      if (place === 1) r.titles++;
      if (place <= 3) r.podiums++;
      rows.set(key, r);
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.titles - a.titles || a.name.localeCompare(b.name)).slice(0, opts.limit ?? 10);
}
