// The rules of a Trivia game, with no database in them so they can be tested on their own.

export const CHOICES = 4;
export const DEFAULT_SECS = 20;
export const MIN_SECS = 5;
export const MAX_SECS = 120;
export const MAX_POINTS = 1000;
// A tap that reaches the server this long after the clock ran out still counts (phones and networks lag a little).
export const GRACE_MS = 1500;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I to mix up

export type Rng = () => number;

/** The short join code: 6 characters from an alphabet without look-alikes. */
export function makeCode(rng: Rng = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return s;
}
/** What a person typed (spaces, lower case, a pasted link) as a join code, or null when it can't be one. */
export function cleanCode(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = t.length > 6 ? t.slice(-6) : t;
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

/** Right answers earn up to 1000 points: all of it for an instant answer, half of it for one at the last second. Wrong or late answers earn nothing. */
export function pointsFor(ok: boolean, ms: number, secs: number): number {
  if (!ok) return 0;
  const total = secs * 1000;
  const t = Math.min(Math.max(ms, 0), total);
  return Math.round(MAX_POINTS * (1 - t / total / 2));
}

export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export interface PoolQuestion { id: string; text: string; choices: string[]; correct: number; secs: number }
export interface PlannedQuestion { id: string; text: string; choices: string[]; correct: number; secs: number }   // choices as shown (shuffled); correct is a position in them

/** A question can be asked once it has text, four answers, and a right one that is filled in. */
export function isAskable(q: { text: string; choices: string[]; correct: number }): boolean {
  return q.text.trim() !== '' && q.choices.length === CHOICES && q.choices.every((c) => c.trim() !== '') && q.correct >= 0 && q.correct < CHOICES;
}

/**
 * The questions of one game: `count` drawn at random from the pool, questions no earlier game of the quiz used first (then repeats if the pool runs out), with the answers of each shuffled.
 * `used` is every question id earlier games of this quiz asked.
 */
export function drawGame(pool: PoolQuestion[], used: ReadonlySet<string>, count: number, rng: Rng = Math.random): PlannedQuestion[] {
  const ready = pool.filter(isAskable);
  const fresh = shuffle(ready.filter((q) => !used.has(q.id)), rng);
  const repeats = shuffle(ready.filter((q) => used.has(q.id)), rng);
  return [...fresh, ...repeats].slice(0, Math.max(0, count)).map((q) => {
    const order = shuffle(q.choices.map((_, i) => i), rng);
    return { id: q.id, text: q.text.trim(), choices: order.map((i) => q.choices[i].trim()), correct: order.indexOf(q.correct), secs: q.secs };
  });
}

export interface Standing { user_id: string; name: string; score: number; time_ms: number; rank: number }
/** Highest score first; equal scores are split by the shorter total time on right answers. Players still tied share a rank. */
export function standings(players: { user_id: string; name: string; score: number; time_ms: number }[]): Standing[] {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.time_ms - b.time_ms || a.name.localeCompare(b.name) || a.user_id.localeCompare(b.user_id));
  return sorted.map((p, i) => {
    const prev = sorted[i - 1];
    const tied = prev && prev.score === p.score && prev.time_ms === p.time_ms;
    return { ...p, rank: tied ? 0 : i + 1 };
  }).reduce<Standing[]>((out, p) => { out.push({ ...p, rank: p.rank || out[out.length - 1].rank }); return out; }, []);
}

/** Totals from the answers given so far, for the players still in the game. */
export function totals(players: { user_id: string; name: string }[], answers: { user_id: string; points: number; ms: number; ok: boolean }[]): { user_id: string; name: string; score: number; time_ms: number }[] {
  const by = new Map(players.map((p) => [p.user_id, { ...p, score: 0, time_ms: 0 }]));
  for (const a of answers) { const t = by.get(a.user_id); if (t) { t.score += a.points; if (a.ok) t.time_ms += a.ms; } }
  return [...by.values()];
}

/** The three who can't return to this quiz: first, second and third place. Ties for third are broken by the standings' own order (shorter total time), so it is always exactly three people (fewer if fewer played). */
export function topThree(list: Standing[]): Standing[] {
  return list.filter((p) => p.score > 0).slice(0, 3);
}
