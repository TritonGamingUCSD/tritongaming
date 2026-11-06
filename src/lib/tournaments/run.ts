import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entrant, Match } from './bracket';
import { buildStage, qualifiers, splitIntoGroups, stageComplete, stageRanking, type StageDef } from './stages';
import { dealHeats } from './points';
import { stageKey, toMatch, toRow, type EntrantRow, type MatchRow, type StageEntrantRow, type StageRow, type TournamentRow } from './store';

export const defOf = (s: StageRow): StageDef => ({ format: s.format, settings: s.settings ?? {}, advance: s.advance ?? { mode: 'none' } });
export const bestOfOf = (t: Pick<TournamentRow, 'best_of'>, s: Pick<StageRow, 'settings'> | undefined, m?: Pick<MatchRow, 'best_of'>) =>
  m?.best_of ?? s?.settings?.best_of ?? t.best_of;

// The stage that is being played now (live), or else the first one not started whose turn it is.
export function currentStage(stages: StageRow[]): StageRow | null {
  return stages.find((s) => s.status === 'live') ?? stages.find((s) => s.status === 'pending') ?? stages[stages.length - 1] ?? null;
}

export function stageEngineMatches(rows: MatchRow[], stage: StageRow): Match[] {
  return rows.filter((r) => r.stage_id === stage.id).map(toMatch);
}

// Who plays a stage and in what seed order: the first stage takes everyone not dropped; a later one takes who the previous stage's rule lets through, best first.
export function stageField(
  stages: StageRow[],
  stage: StageRow,
  entrants: Pick<EntrantRow, 'id' | 'seed' | 'dropped'>[],
  rows: MatchRow[],
  stageEntrants: StageEntrantRow[],
): Entrant[] {
  const mine = stageEntrants.filter((x) => x.stage_id === stage.id).sort((a, b) => a.seed - b.seed);
  if (mine.length > 0) return mine.map((x, i) => ({ id: x.entrant_id, seed: i + 1 }));
  if (stage.position === 1) {
    const active = entrants.filter((e) => !e.dropped);
    return [...active].sort((x, y) => (x.seed ?? 1e9) - (y.seed ?? 1e9)).map((e, i) => ({ id: e.id, seed: i + 1 }));
  }
  const prev = stages.find((s) => s.position === stage.position - 1);
  if (!prev) return [];
  const prevField = stageField(stages, prev, entrants, rows, stageEntrants);
  const ranking = stageRanking(defOf(prev), prevField, stageEngineMatches(rows, prev));
  const dropped = new Set(entrants.filter((e) => e.dropped).map((e) => e.id));
  return qualifiers(defOf(prev), ranking)
    .filter((id) => !dropped.has(id))
    .map((id, i) => ({ id, seed: i + 1 }));
}

// Build and store a stage: its entrants with seeds (and pools), then its first matches. Pools set by hand beforehand (group_no on the stage's entrants) are kept.
export async function startStage(svc: SupabaseClient, t: TournamentRow, stage: StageRow, field: Entrant[], existing: StageEntrantRow[]): Promise<number> {
  const def = defOf(stage);
  let groups: Entrant[][] | undefined;
  if (def.format === 'roundrobin') {
    const given = existing.filter((x) => x.stage_id === stage.id && x.group_no);
    if (given.length === field.length && field.every((e) => given.some((g) => g.entrant_id === e.id))) {
      const nums = [...new Set(given.map((g) => g.group_no as number))].sort((a, b) => a - b);
      groups = nums.map((n) => field.filter((e) => given.find((g) => g.entrant_id === e.id)?.group_no === n));
    } else groups = splitIntoGroups(field, def.settings.group_count ?? 1, def.settings.seeding ?? 'seed');
  }
  const made = buildStage(def, field, groups);
  let heatRows: Record<string, unknown>[] = [];
  if (def.format === 'points')
    heatRows = heatRowsFor(
      t.id,
      stage,
      dealHeats(
        field.map((e) => e.id),
        def.settings.heat_size ?? 4,
      ),
      1,
    );
  await svc.from('tournament_stage_entrants').delete().eq('stage_id', stage.id);
  await svc
    .from('tournament_stage_entrants')
    .insert(field.map((e) => ({ stage_id: stage.id, entrant_id: e.id, seed: e.seed, group_no: groups ? groups.findIndex((g) => g.some((x) => x.id === e.id)) + 1 : null })));
  if (made.length > 0) {
    const { error } = await svc.from('tournament_matches').insert(made.map((m) => toRow(t.id, stage, m, { best_of: def.settings.best_of ?? null })));
    if (error) throw new Error('Could not build the bracket.');
  }
  if (heatRows.length > 0) {
    const { error } = await svc.from('tournament_matches').insert(heatRows);
    if (error) throw new Error('Could not deal the heats.');
  }
  const now = new Date().toISOString();
  await svc.from('tournament_stages').update({ status: 'live' }).eq('id', stage.id);
  await svc.from('tournaments').update({ status: 'live', signups_open: false, updated_at: now }).eq('id', t.id);
  return made.length + heatRows.length;
}

// The rows for one round of heats: each is a match with no sides, only a list of who is in it (and, once scored, where they finished and what it earned).
export function heatRowsFor(tournamentId: string, stage: Pick<StageRow, 'id' | 'position'>, heats: string[][], round: number) {
  return heats.map((h, i) => ({
    tournament_id: tournamentId,
    stage_id: stage.id,
    group_no: null,
    key: stageKey(stage.position, `P${round}-${i + 1}`),
    bracket: 'P',
    round,
    idx: i + 1,
    a: null,
    b: null,
    score_a: null,
    score_b: null,
    winner: null,
    status: 'ready',
    win_to: null,
    lose_to: null,
    heat: h.map((entrant_id) => ({ entrant_id, placement: null, points: null })),
  }));
}

// After a result: is this stage finished, and is the whole tournament? Writes the statuses and says what changed.
export async function refreshStatus(svc: SupabaseClient, t: TournamentRow, stages: StageRow[], stage: StageRow, matches: Match[], players: number) {
  const done = stageComplete(defOf(stage), players, matches);
  if (done !== (stage.status === 'complete'))
    await svc
      .from('tournament_stages')
      .update({ status: done ? 'complete' : 'live' })
      .eq('id', stage.id);
  const last = stages[stages.length - 1]?.id === stage.id;
  const whole = done && last;
  if (whole !== (t.status === 'complete'))
    await svc
      .from('tournaments')
      .update({ status: whole ? 'complete' : 'live', updated_at: new Date().toISOString() })
      .eq('id', t.id);
  return { stageDone: done, complete: whole };
}
