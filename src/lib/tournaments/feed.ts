import { BYE, placements, standings, swissRounds, type Match } from './bracket';
import { toMatch, type EntrantRow, type MatchRow, type TournamentRow } from './store';

// What a stream tool, the public page and the overlays read: names instead of ids, ordered matches, standings or placements, and what is on now and next. No user ids, codes or tokens.
export type FeedMatch = {
  key: string;
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
};

export function buildFeed(t: TournamentRow, entrants: EntrantRow[], rows: MatchRow[]) {
  const byId = new Map(entrants.map((e) => [e.id, e]));
  const side = (slot: string | null) => {
    if (slot === null) return null;
    if (slot === BYE) return { id: null, name: 'BYE', seed: null };
    const e = byId.get(slot);
    return { id: slot, name: e?.name ?? 'TBD', seed: e?.seed ?? null };
  };
  const matches: FeedMatch[] = [...rows]
    .sort((x, y) => x.bracket.localeCompare(y.bracket) || x.round - y.round || x.idx - y.idx)
    .map((r) => ({
      key: r.key,
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
    }));
  const engine: Match[] = rows.map(toMatch);
  const ids = entrants.filter((e) => !e.dropped).map((e) => e.id);
  const table = t.format === 'roundrobin' || t.format === 'swiss' ? standings(ids, engine).map((r, i) => ({ ...r, place: i + 1, name: byId.get(r.id)?.name ?? '' })) : null;
  const places = t.format === 'single' || t.format === 'double' ? placements(engine).map((p) => ({ place: p.place, name: byId.get(p.id)?.name ?? '' })) : null;
  const playable = matches.filter((m) => m.status === 'ready' || m.status === 'live');
  return {
    tournament: {
      name: t.name,
      slug: t.slug,
      game: t.game,
      format: t.format,
      best_of: t.best_of,
      status: t.status,
      entrant_type: t.entrant_type,
      starts_at: t.starts_at,
      swiss_rounds: t.format === 'swiss' ? (t.swiss_rounds ?? swissRounds(ids.length)) : null,
    },
    entrants: entrants.map((e) => ({ id: e.id, name: e.name, seed: e.seed, dropped: e.dropped })),
    matches,
    standings: table,
    placements: places,
    now: playable.filter((m) => m.status === 'live'),
    next: playable.filter((m) => m.status === 'ready').slice(0, 6),
    updated: new Date().toISOString(),
  };
}
