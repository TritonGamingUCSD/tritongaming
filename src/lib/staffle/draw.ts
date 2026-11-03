// The Staffle draw. Pure logic: given the items (each with how many winners and who entered) and a seed, it picks the winners. The same seed always gives the same result, so a draw can be shown on the
// projector one item at a time from what was saved, and checked later.
//   - Nobody wins twice: a person who wins an item drops out of every later one. The one exception: a prize only ONE person entered always goes to that person, even if they win another prize too (it does not use up their one prize).
//   - The prizes are drawn in order of their `rank` (lower first: the most valuable first, see `rankByValue`), and people who do not win stay in for every prize drawn after, so entering a cheap prize never costs a chance at a better one.
//   - Among prizes with the same rank, the one with the fewest entrants for each winner is drawn next (worked out again after every prize, since winners drop out; ties are random). So of two similar prizes, one only a person entered goes to
//     that person, and the popular one is drawn from whoever is left.
//   - An item with N winners gives N different people. When fewer entered than there are winners, they all win it.
//   - Spots still open after that go to the leftover pools: the people who said they would take anything first, then everyone else who may enter and has not won.

export interface DrawItem {
  id: string;
  winners: number;
  entrants: string[];
  /** When it is drawn: lower first, the same number is a tie (0 for all when not given). */
  rank?: number;
}
export interface Won {
  item_id: string;
  user_id: string;
  position: number;
  /** 'entered': they entered this prize. 'leftover': it was nobody's pick and they came from a leftover pool. */
  via: 'entered' | 'leftover';
}
export interface DrawPools {
  /** People who said they would take anything that is left. */
  anything?: string[];
  /** Everyone who may enter (the draw leaves out whoever has already won). */
  everyone?: string[];
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

export function draw(items: DrawItem[], seed: string, alreadyWon: Iterable<string> = [], pools: DrawPools = {}): { won: Won[]; order: string[] } {
  const next = rng(seed);
  const gone = new Set(alreadyWon);
  const initiallyGone = new Set(gone);
  const tie = new Map(shuffle(items, next).map((it, i) => [it.id, i])); // the random order that settles ties
  const open = new Map(items.map((i) => [i.id, i.winners]));
  const won: Won[] = [];
  const order: string[] = [];
  const give = (item: DrawItem, user: string, via: Won['via']) => {
    gone.add(user);
    open.set(item.id, (open.get(item.id) ?? 0) - 1);
    won.push({ item_id: item.id, user_id: user, position: won.length, via });
    if (!order.includes(item.id)) order.push(item.id);
  };

  // 0. a prize exactly one person entered goes to them, whatever else they win (it does not make them drop out of the other prizes)
  const pending = new Set(items.map((i) => i.id));
  for (const item of items) {
    const only = [...new Set(item.entrants)];
    if (only.length !== 1 || initiallyGone.has(only[0]) || item.winners < 1) continue;
    pending.delete(item.id);
    open.set(item.id, (open.get(item.id) ?? 0) - 1);
    won.push({ item_id: item.id, user_id: only[0], position: won.length, via: 'entered' });
    if (!order.includes(item.id)) order.push(item.id);
  }

  // 1. the prizes people entered, the least contested first
  for (;;) {
    let best: DrawItem | null = null;
    let bestRatio = Infinity;
    for (const item of items) {
      if (!pending.has(item.id)) continue;
      const avail = new Set(item.entrants.filter((u) => !gone.has(u))).size;
      if (avail === 0) continue;
      const ratio = avail / item.winners;
      const rank = item.rank ?? 0;
      const better = !best || rank < (best.rank ?? 0) || (rank === (best.rank ?? 0) && (ratio < bestRatio || (ratio === bestRatio && tie.get(item.id)! < tie.get(best.id)!)));
      if (better) {
        best = item;
        bestRatio = ratio;
      }
    }
    if (!best) break;
    pending.delete(best.id);
    const pool = shuffle([...new Set(best.entrants)].filter((u) => !gone.has(u)).sort(), next); // sorted first so the shuffle does not depend on the order entries were read in
    for (const u of pool.slice(0, best.winners)) give(best, u, 'entered');
  }

  // 2. open spots go to the leftover pools
  const anything = shuffle([...new Set(pools.anything ?? [])].sort(), next);
  const everyone = shuffle([...new Set(pools.everyone ?? [])].sort(), next);
  for (const item of [...items].sort((a, b) => tie.get(a.id)! - tie.get(b.id)!)) {
    for (const list of [anything, everyone]) {
      for (const u of list) {
        if ((open.get(item.id) ?? 0) <= 0) break;
        if (!gone.has(u) && !won.some((w) => w.item_id === item.id && w.user_id === u)) give(item, u, 'leftover'); // (never the same prize twice)
      }
    }
  }
  return { won, order };
}

/** About how likely you are to win a prize if you enter it, from how many have entered (counting you) and how many win it: `all` when everyone who enters wins. A guide: the draw also drops people who win another prize first. */
export function oddsOf(entries: number, winners: number, entered: boolean): { all: boolean; oneIn: number } {
  const n = Math.max(1, entries + (entered ? 0 : 1));
  return { all: n <= winners, oneIn: Math.max(1, Math.round(n / winners)) };
}

/** The draw rank of each prize by value when nobody set one: the most valuable first, and prizes whose price is within 20% of the first of their group count as the same (so rare, similar prizes can still go to the person who entered them). */
export function rankByValue(prizes: { id: string; price: number }[]): Map<string, number> {
  const sorted = [...prizes].sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
  const out = new Map<string, number>();
  let group = 0;
  let top = Infinity;
  for (const p of sorted) {
    if (group === 0 || p.price < top * 0.8) {
      group++;
      top = p.price;
    }
    out.set(p.id, group);
  }
  return out;
}

/** The final rank of each item: the number the host set (1 to 99), or else by value after all the numbered ones. */
export function ranksFor(items: { id: string; draw_order: number | null; price: number }[]): Map<string, number> {
  const byValue = rankByValue(items.map((i) => ({ id: i.id, price: i.price })));
  return new Map(items.map((i) => [i.id, i.draw_order ?? 100 + (byValue.get(i.id) ?? 1)]));
}
