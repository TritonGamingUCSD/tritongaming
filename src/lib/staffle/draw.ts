// The Staffle draw. Pure logic: given the items (each with how many winners and who entered) and a seed, it picks the winners. The same seed always gives the same result, so a draw can be shown on the
// projector one item at a time from what was saved, and checked later.
//   - The items are drawn in a random order (a different one every Staffle).
//   - A person who wins an item drops out of every later item: nobody wins twice in one Staffle.
//   - An item with N winners gives N different people (or fewer, when fewer entered).

export interface DrawItem {
  id: string;
  winners: number;
  entrants: string[];
}
export interface Won {
  item_id: string;
  user_id: string;
  position: number;
}

// A small seeded random number generator (mulberry32 over a hash of the seed text).
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(list: T[], next: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function draw(items: DrawItem[], seed: string, alreadyWon: Iterable<string> = []): { won: Won[]; order: string[] } {
  const next = rng(seed);
  const gone = new Set(alreadyWon);
  const order = shuffle(items, next);
  const won: Won[] = [];
  for (const item of order) {
    const pool = shuffle([...new Set(item.entrants)].filter((u) => !gone.has(u)).sort(), next); // sorted first so the shuffle does not depend on the order entries were read in
    for (const u of pool.slice(0, item.winners)) {
      gone.add(u);
      won.push({ item_id: item.id, user_id: u, position: won.length });
    }
  }
  return { won, order: order.map((i) => i.id) };
}
