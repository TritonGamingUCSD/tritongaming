// Points series (free for all): players are dealt into heats of several, each heat is scored by placement, placements earn points from a table, and the standings are the sum over the rounds. Pure functions; the database only stores the heats.
export interface HeatSlot {
  entrant_id: string;
  placement: number | null;
  points: number | null;
}
export const DEFAULT_POINTS = [10, 6, 4, 2];

/** Points for a placement (1-based); beyond the table nothing. */
export const pointsFor = (placement: number, table: number[] = DEFAULT_POINTS): number => table[placement - 1] ?? 0;

/** Deal an ordered list (best first) into heats of about `size`, snake style so every heat has the same strength: 1→A, 2→B, 3→B, 4→A... Sizes differ by at most one. */
export function dealHeats(ids: string[], size: number): string[][] {
  const count = Math.max(1, Math.ceil(ids.length / Math.max(2, size)));
  const heats: string[][] = Array.from({ length: count }, () => []);
  ids.forEach((id, i) => {
    const row = Math.floor(i / count);
    const col = i % count;
    heats[row % 2 === 0 ? col : count - 1 - col].push(id);
  });
  return heats;
}

/** Score one heat from the order players finished in (first to last). */
export function scoreHeat(order: string[], table: number[] = DEFAULT_POINTS): HeatSlot[] {
  return order.map((entrant_id, i) => ({ entrant_id, placement: i + 1, points: pointsFor(i + 1, table) }));
}

export interface PointsRow {
  id: string;
  points: number;
  wins: number;
  played: number;
  best: number;
}

/** Totals over every scored heat, best first (ties: more wins, then better best finish). */
export function pointsStandings(ids: string[], heats: HeatSlot[][]): PointsRow[] {
  const rows = new Map<string, PointsRow>(ids.map((id) => [id, { id, points: 0, wins: 0, played: 0, best: 99 }]));
  for (const h of heats) {
    for (const s of h) {
      const r = rows.get(s.entrant_id);
      if (!r || s.placement === null) continue;
      r.points += s.points ?? 0;
      r.played++;
      if (s.placement === 1) r.wins++;
      r.best = Math.min(r.best, s.placement);
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.best - b.best || a.id.localeCompare(b.id));
}
