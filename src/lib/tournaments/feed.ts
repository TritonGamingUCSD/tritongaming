import { BYE, swissRounds, type Match } from './bracket';
import { currentStage, defOf, stageEngineMatches, stageField } from './run';
import { rank, stageRanking } from './stages';
import { pointsStandings } from './points';
import { toMatch, type EntrantRow, type MatchRow, type StageEntrantRow, type StageRow, type TournamentRow } from './store';

// What a stream tool, the public page and the overlays read: names instead of ids, ordered matches, stages, standings or placements, and what is on now and next. No user ids, codes or tokens.
export type FeedMatch = {
  key: string;
  stage: number;
  group: number | null;
  bracket: string;
  round: number;
  index: number;
  a: { id: string | null; name: string; seed: number | null } | null;
  b: { id: string | null; name: string; seed: number | null } | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: 'a' | 'b' | null;
  status: string;
  station: string | null;
  games: MatchRow['games'];
  best_of: number | null;
  heat: { name: string; placement: number | null; points: number | null }[] | null;
};

export function buildFeed(t: TournamentRow, entrants: EntrantRow[], rows: MatchRow[], stages: StageRow[], stageEntrants: StageEntrantRow[]) {
  const byId = new Map(entrants.map((e) => [e.id, e]));
  const posOf = new Map(stages.map((s) => [s.id, s.position]));
  const side = (slot: string | null) => {
    if (slot === null) return null;
    if (slot === BYE) return { id: null, name: 'BYE', seed: null };
    const e = byId.get(slot);
    return { id: slot, name: e?.name ?? 'TBD', seed: e?.seed ?? null };
  };
  const matches: FeedMatch[] = [...rows]
    .sort(
      (x, y) =>
        (posOf.get(x.stage_id ?? '') ?? 0) - (posOf.get(y.stage_id ?? '') ?? 0) ||
        x.bracket.localeCompare(y.bracket) ||
        (x.group_no ?? 0) - (y.group_no ?? 0) ||
        x.round - y.round ||
        x.idx - y.idx,
    )
    .map((r) => ({
      key: r.key,
      stage: posOf.get(r.stage_id ?? '') ?? 1,
      group: r.group_no,
      bracket: r.bracket,
      round: r.round,
      index: r.idx,
      a: side(r.a),
      b: side(r.b),
      scoreA: r.score_a,
      scoreB: r.score_b,
      winner: r.winner,
      status: r.status,
      station: r.station,
      games: r.games,
      best_of: r.best_of,
      heat: r.heat ? r.heat.map((h) => ({ name: byId.get(h.entrant_id)?.name ?? '?', placement: h.placement, points: h.points })) : null,
    }));
  const cur = currentStage(stages);
  const nameOf = (id: string) => byId.get(id)?.name ?? '';
  let standings: { place: number; name: string; group: number | null; played: number; wins: number; losses: number; draws: number; points: number; diff: number }[] | null = null;
  let placements: { place: number; name: string }[] | null = null;
  if (cur) {
    const field = stageField(stages, cur, entrants, rows, stageEntrants);
    const engine: Match[] = stageEngineMatches(rows, cur);
    const def = defOf(cur);
    if (def.format === 'points') {
      const heats = rows.filter((r) => r.stage_id === cur.id).map((r) => r.heat ?? []);
      standings = pointsStandings(
        field.map((e) => e.id),
        heats,
      ).map((r, i) => ({ place: i + 1, name: nameOf(r.id), group: null, played: r.played, wins: r.wins, losses: 0, draws: 0, points: r.points, diff: 0 }));
    } else if (def.format === 'roundrobin' || def.format === 'swiss') {
      const seeds = new Map(field.map((e) => [e.id, e.seed]));
      const groups = [...new Set(engine.map((m) => m.group ?? 0))];
      standings = groups.flatMap((g) => {
        const inG = engine.filter((m) => (m.group ?? 0) === g);
        const ids = g ? [...new Set(inG.flatMap((m) => [m.a, m.b]).filter((x): x is string => !!x && x !== BYE))] : field.map((e) => e.id);
        return rank(ids, inG, def.settings, seeds).map((r, i) => ({
          place: i + 1,
          name: nameOf(r.id),
          group: g || null,
          played: r.played,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws,
          points: r.points,
          diff: r.diff,
        }));
      });
    }
  }
  const last = stages[stages.length - 1];
  if (last && (last.format === 'single' || last.format === 'double') && last.status !== 'pending') {
    const field = stageField(stages, last, entrants, rows, stageEntrants);
    placements = stageRanking(defOf(last), field, rows.filter((r) => r.stage_id === last.id).map(toMatch)).map((p) => ({ place: p.place, name: nameOf(p.id) }));
  }
  const playable = matches.filter((m) => m.status === 'ready' || m.status === 'live');
  const active = entrants.filter((e) => !e.dropped).length;
  return {
    tournament: {
      id: t.id,
      name: t.name,
      slug: t.slug,
      game: t.game,
      format: t.format,
      best_of: t.best_of,
      status: t.status,
      entrant_type: t.entrant_type,
      team_size: t.team_size,
      signups_open: t.signups_open && t.status === 'registration',
      starts_at: t.starts_at,
      swiss_rounds: cur?.format === 'swiss' ? (cur.settings.swiss_rounds ?? swissRounds(active)) : null,
    },
    links: ((t.settings?.external as { provider: string; url: string; label?: string }[] | undefined) ?? []).map((l) => ({
      provider: l.provider,
      url: l.url,
      label: l.label ?? null,
    })),
    stages: stages.map((s) => ({ position: s.position, name: s.name, format: s.format, status: s.status, best_of: s.settings.best_of ?? t.best_of })),
    current_stage: cur?.position ?? 1,
    entrants: entrants.map((e) => ({ id: e.id, name: e.name, seed: e.seed, dropped: e.dropped })),
    matches,
    standings,
    placements,
    now: playable.filter((m) => m.status === 'live'),
    next: playable.filter((m) => m.status === 'ready').slice(0, 6),
    updated: new Date().toISOString(),
  };
}
