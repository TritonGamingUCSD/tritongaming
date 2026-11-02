// How a poll is voted and counted. Plain functions (the routes and the screens share them).
//   one   a single favourite: one entry, value 1
//   top3  a first, second and third choice: up to three different entries worth 3, 2 and 1 points
//   score every entry the person rated: each 1 to 5

export const POLL_MODES = ['one', 'top3', 'score'] as const;
export type PollMode = (typeof POLL_MODES)[number];
export const POLL_REVEALS = ['live', 'hidden'] as const;
export type PollReveal = (typeof POLL_REVEALS)[number];
export type PollStatus = 'draft' | 'open' | 'closed' | 'revealed';

export const MODE_NAMES: Record<PollMode, string> = { one: 'Pick One Favourite', top3: 'Rank Top 3', score: 'Score Each Entry (1 To 5)' };
export const MODE_ABOUT: Record<PollMode, string> = {
  one: 'Each guest taps one entry. The one with the most votes wins.',
  top3: 'Each guest picks a 1st, 2nd and 3rd choice (3, 2 and 1 points). The most points wins.',
  score: 'Each guest rates the entries from 1 to 5 stars. The highest average wins.',
};
export const REVEAL_NAMES: Record<PollReveal, string> = { live: 'Live Bars While Voting', hidden: 'Hidden Until I Reveal' };

export interface Vote {
  entry_id: string;
  value: number;
}

/** The most points a place in a top 3 is worth, and the best score. */
export const TOP_POINTS = 3;
export const MAX_SCORE = 5;

/** Brings what a phone sent into a valid vote for the mode (only the poll's own entries, no entry twice), or says why not. */
export function cleanVotes(mode: PollMode, entryIds: string[], raw: unknown): { votes: Vote[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Pick at least one entry.' };
  const valid = new Set(entryIds);
  const seen = new Set<string>();
  const votes: Vote[] = [];
  for (const v of raw as { entry_id?: unknown; value?: unknown }[]) {
    const id = typeof v?.entry_id === 'string' ? v.entry_id : '';
    const value = Math.round(Number(v?.value));
    if (!valid.has(id)) return { error: 'One of those entries isn’t in this poll.' };
    if (seen.has(id)) return { error: 'Each entry can be picked only once.' };
    seen.add(id);
    votes.push({ entry_id: id, value });
  }
  if (!votes.length) return { error: 'Pick at least one entry.' };
  if (mode === 'one') {
    if (votes.length !== 1 || votes[0].value !== 1) return { error: 'Pick exactly one favourite.' };
  } else if (mode === 'top3') {
    if (votes.length > 3) return { error: 'Pick at most three.' };
    const points = votes.map((v) => v.value).sort();
    if (points.some((p) => p < 1 || p > TOP_POINTS) || new Set(points).size !== points.length) return { error: 'Give each choice its own place: 1st, 2nd or 3rd.' };
  } else if (votes.some((v) => v.value < 1 || v.value > MAX_SCORE)) return { error: 'A score is 1 to 5.' };
  return { votes };
}

export interface EntryInfo {
  id: string;
  number: number;
  name: string;
  subtitle: string;
  image: string;
}
export interface Standing extends EntryInfo {
  /** What the bar shows: votes, points, or the average score. */
  total: number;
  /** How many people voted for (or scored) this entry. */
  voters: number;
  /** Top 3: how many put it first. */
  firsts: number;
  /** Where it ranks (1 = best; entries that tie share a place). */
  place: number;
}

/** Everyone's votes counted: best first, ties broken by the next measure (firsts, then voters), then by number. */
export function tally(mode: PollMode, entries: EntryInfo[], votes: { entry_id: string; value: number }[]): Standing[] {
  const by = new Map<string, { sum: number; n: number; firsts: number }>();
  for (const e of entries) by.set(e.id, { sum: 0, n: 0, firsts: 0 });
  for (const v of votes) {
    const t = by.get(v.entry_id);
    if (!t) continue;
    t.sum += v.value;
    t.n++;
    if (mode === 'top3' && v.value === TOP_POINTS) t.firsts++;
  }
  const rows = entries.map((e) => {
    const t = by.get(e.id)!;
    const total = mode === 'score' ? (t.n ? Math.round((t.sum / t.n) * 100) / 100 : 0) : t.sum;
    return { ...e, total, voters: t.n, firsts: t.firsts, place: 0 };
  });
  rows.sort((a, b) => b.total - a.total || b.firsts - a.firsts || b.voters - a.voters || a.number - b.number);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.place = prev && prev.total === r.total && prev.firsts === r.firsts && prev.voters === r.voters ? prev.place : i + 1;
  });
  return rows;
}

/** How many different people have voted. */
export const voterCount = (votes: { user_id: string }[]): number => new Set(votes.map((v) => v.user_id)).size;
