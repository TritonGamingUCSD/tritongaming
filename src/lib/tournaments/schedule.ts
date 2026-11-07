// Start times for a tournament's matches: round by round, a few at a time, so the host fills the day in with one press. Pure.
export interface ScheduleInput {
  key: string;
  bracket: string;
  round: number;
  idx: number;
  status: string;
}
const ORDER = ['W', 'L', 'GF', 'T', 'RR', 'S', 'P'];
const rank = (b: string) => {
  const i = ORDER.indexOf(b);
  return i < 0 ? ORDER.length : i;
};

/**
 * One start time for each match that is waiting or coming: the matches of a round run `parallel` at a time, each slot `minutes` long, with `gap` minutes between slots; the next round starts after the last slot of the one before.
 * Finished, skipped and bye matches get nothing. Returns key → ISO time.
 */
export function scheduleMatches(matches: ScheduleInput[], opts: { start: string; minutes: number; parallel: number; gap?: number }): Map<string, string> {
  const out = new Map<string, string>();
  const t0 = Date.parse(opts.start);
  if (Number.isNaN(t0)) return out;
  const minutes = Math.max(1, Math.min(600, Math.round(opts.minutes)));
  const parallel = Math.max(1, Math.min(64, Math.round(opts.parallel)));
  const gap = Math.max(0, Math.min(240, Math.round(opts.gap ?? 0)));
  const todo = matches.filter((m) => m.status !== 'done' && m.status !== 'skipped' && m.status !== 'bye');
  const rounds = [...new Set(todo.map((m) => m.round))].sort((a, b) => a - b);
  let cursor = t0;
  for (const r of rounds) {
    const inRound = todo.filter((m) => m.round === r).sort((a, b) => rank(a.bracket) - rank(b.bracket) || a.idx - b.idx);
    for (let i = 0; i < inRound.length; i += parallel) {
      for (const m of inRound.slice(i, i + parallel)) out.set(m.key, new Date(cursor).toISOString());
      cursor += (minutes + gap) * 60_000;
    }
  }
  return out;
}

/** The key a round name is stored under in a stage's settings: the bracket letter and the round, like W2 or GF1. */
export const roundKey = (bracket: string, round: number) => `${bracket}${round}`;

/** A round's name: the one the host gave it, or the default. */
export const roundLabel = (names: Record<string, string> | null | undefined, bracket: string, round: number, fallback: string) =>
  names?.[roundKey(bracket, round)]?.trim() || fallback;

/** Round names from whatever came in: keys like W2, short names, no more than 40 of them. */
export function cleanRoundNames(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 60)) {
    if (!/^[A-Z]{1,2}\d{1,3}$/.test(k) || typeof v !== 'string') continue;
    const name = v.trim().slice(0, 30);
    if (name) out[k] = name;
  }
  return out;
}
