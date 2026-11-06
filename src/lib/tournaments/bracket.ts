// The bracket engine: pure functions, no database. It builds the matches for a format, takes results, and moves winners (and losers, in double elimination) along.
// A match has two slots. A slot holds an entrant id, BYE (nobody will ever be there) or null (not decided yet). A match with a BYE side settles by itself.

export const BYE = 'BYE' as const;
export type Slot = string | typeof BYE | null;
export type Side = 'a' | 'b';
export type Format = 'single' | 'double' | 'roundrobin' | 'swiss';
export type Bracket = 'W' | 'L' | 'GF' | 'RR' | 'S' | 'T';
export type Link = { key: string; side: Side };

export type Match = {
  key: string; // W1-1, L2-3, GF1, GF2, RR3-2, S2-4, T
  bracket: Bracket;
  round: number;
  index: number; // 1-based position in the round
  a: Slot;
  b: Slot;
  scoreA: number | null;
  scoreB: number | null;
  winner: Side | null;
  status: 'pending' | 'ready' | 'done' | 'bye' | 'skipped';
  winTo?: Link;
  loseTo?: Link;
};

export type Entrant = { id: string; seed: number };

function blank(key: string, bracket: Bracket, round: number, index: number): Match {
  return { key, bracket, round, index, a: null, b: null, scoreA: null, scoreB: null, winner: null, status: 'pending' };
}

// Standard seeding order for a bracket of `size` (a power of 2): [1, 16, 8, 9, 4, 13, 5, 12, ...] so seed 1 meets seed 2 only in the final.
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

const pow2 = (n: number) => {
  let p = 2;
  while (p < n) p *= 2;
  return p;
};

function singleElimination(entrants: Entrant[], thirdPlace: boolean): Match[] {
  const size = pow2(entrants.length);
  const rounds = Math.log2(size);
  const bySeed = new Map(entrants.map((e) => [e.seed, e.id]));
  const out: Match[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (let i = 1; i <= size / 2 ** r; i++) {
      const m = blank(`W${r}-${i}`, 'W', r, i);
      if (r < rounds) m.winTo = { key: `W${r + 1}-${Math.ceil(i / 2)}`, side: i % 2 ? 'a' : 'b' };
      out.push(m);
    }
  }
  const order = seedOrder(size);
  for (let i = 0; i < size / 2; i++) {
    const m = out.find((x) => x.key === `W1-${i + 1}`)!;
    m.a = bySeed.get(order[i * 2]) ?? BYE;
    m.b = bySeed.get(order[i * 2 + 1]) ?? BYE;
  }
  if (thirdPlace && rounds >= 2) {
    const t = blank('T', 'T', rounds, 1);
    out.push(t);
    const semis = out.filter((m) => m.bracket === 'W' && m.round === rounds - 1);
    semis[0].loseTo = { key: 'T', side: 'a' };
    semis[1].loseTo = { key: 'T', side: 'b' };
  }
  return out;
}

function doubleElimination(entrants: Entrant[]): Match[] {
  const out = singleElimination(entrants, false);
  const size = pow2(entrants.length);
  const R = Math.log2(size);
  if (R < 2) return out;
  // Losers bracket rounds 1 .. 2R-2. L1 takes the W1 losers in pairs; each W(k+1) feeds L(2k) in its second slot.
  const count = (round: number) => (round % 2 === 1 ? size / 2 ** ((round + 1) / 2 + 1) : size / 2 ** (round / 2 + 1));
  for (let r = 1; r <= 2 * R - 2; r++) {
    for (let i = 1; i <= count(r); i++) {
      const m = blank(`L${r}-${i}`, 'L', r, i);
      if (r < 2 * R - 2) {
        // An odd round goes straight on (same position); an even round pairs up into the next odd round.
        m.winTo = r % 2 === 1 ? { key: `L${r + 1}-${i}`, side: 'a' } : { key: `L${r + 1}-${Math.ceil(i / 2)}`, side: i % 2 ? 'a' : 'b' };
      } else m.winTo = { key: 'GF1', side: 'b' };
      out.push(m);
    }
  }
  const get = (k: string) => out.find((m) => m.key === k)!;
  // Winners-bracket losers drop in.
  for (let i = 1; i <= size / 2; i++) get(`W1-${i}`).loseTo = { key: `L1-${Math.ceil(i / 2)}`, side: i % 2 ? 'a' : 'b' };
  for (let k = 2; k <= R; k++) {
    const n = size / 2 ** k;
    for (let i = 1; i <= n; i++) get(`W${k}-${i}`).loseTo = { key: `L${2 * (k - 1)}-${i}`, side: 'b' };
  }
  get(`W${R}-1`).winTo = { key: 'GF1', side: 'a' };
  out.push(blank('GF1', 'GF', 1, 1), blank('GF2', 'GF', 2, 1));
  return out;
}

function roundRobin(entrants: Entrant[]): Match[] {
  const ids: Slot[] = entrants.map((e) => e.id);
  if (ids.length % 2) ids.push(BYE);
  const n = ids.length;
  const out: Match[] = [];
  const ring = ids.slice(1);
  for (let r = 1; r < n; r++) {
    const row = [ids[0], ...ring];
    for (let i = 0; i < n / 2; i++) {
      const m = blank(`RR${r}-${i + 1}`, 'RR', r, i + 1);
      m.a = row[i];
      m.b = row[n - 1 - i];
      out.push(m);
    }
    ring.unshift(ring.pop()!);
  }
  return out;
}

export function generate(format: Format, entrants: Entrant[], opts: { thirdPlace?: boolean } = {}): Match[] {
  if (entrants.length < 2) throw new Error('A bracket needs at least two entrants.');
  const sorted = [...entrants].sort((x, y) => x.seed - y.seed).map((e, i) => ({ id: e.id, seed: i + 1 }));
  let matches: Match[];
  if (format === 'single') matches = singleElimination(sorted, !!opts.thirdPlace);
  else if (format === 'double') matches = doubleElimination(sorted);
  else if (format === 'roundrobin') matches = roundRobin(sorted);
  else
    matches = swissRound(
      sorted.map((e) => e.id),
      [],
      1,
    );
  return settle(matches);
}

const key = (m: Match[]) => new Map(m.map((x) => [x.key, x]));

function put(map: Map<string, Match>, link: Link | undefined, value: Slot) {
  if (!link) return;
  const t = map.get(link.key);
  if (t) t[link.side] = value;
}

// Settle everything that can settle: matches with a BYE side finish by themselves, matches with both sides known become ready, and results move along. Run after any change.
export function settle(matches: Match[]): Match[] {
  const map = key(matches);
  const order = [...matches].sort((x, y) => (x.bracket === y.bracket ? x.round - y.round || x.index - y.index : 0));
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (const m of order) {
      if (m.status === 'done' || m.status === 'skipped') continue;
      if (m.bracket === 'GF' && m.round === 2) continue; // the reset match is handled when the first final is reported
      const wasStatus = m.status;
      if (m.a === null || m.b === null) {
        m.status = 'pending';
      } else if (m.a === BYE || m.b === BYE) {
        m.status = 'bye';
        m.winner = m.a === BYE ? (m.b === BYE ? 'a' : 'b') : 'a';
        const winSlot: Slot = m.a === BYE && m.b === BYE ? BYE : m.winner === 'a' ? m.a : m.b;
        put(map, m.winTo, winSlot);
        put(map, m.loseTo, BYE);
      } else {
        m.status = 'ready';
      }
      if (m.status !== wasStatus) changed = true;
    }
  }
  return matches;
}

export function clone(matches: Match[]): Match[] {
  return matches.map((m) => ({ ...m, winTo: m.winTo && { ...m.winTo }, loseTo: m.loseTo && { ...m.loseTo } }));
}

// Enter a result. Throws a plain message when it cannot be: the match is not ready, the scores tie (elimination formats), or the result would change a winner whose next match was already played.
export function report(current: Match[], matchKey: string, scoreA: number, scoreB: number, opts: { allowTie?: boolean } = {}): Match[] {
  const matches = clone(current);
  const map = key(matches);
  const m = map.get(matchKey);
  if (!m) throw new Error('That match does not exist.');
  if (m.status !== 'ready' && m.status !== 'done') throw new Error('That match is not ready yet.');
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) throw new Error('Scores are whole numbers from 0 up.');
  const tie = scoreA === scoreB;
  const robin = m.bracket === 'RR' || m.bracket === 'S';
  if (tie && !(robin && opts.allowTie)) throw new Error('A match needs a winner. Scores cannot tie here.');
  const winner: Side | null = tie ? null : scoreA > scoreB ? 'a' : 'b';
  if (m.status === 'done' && m.winner !== winner) {
    for (const link of [m.winTo, m.loseTo]) {
      const t = link && map.get(link.key);
      if (t && (t.status === 'done' || (t.status as string) === 'bye')) throw new Error('The next match has already been played. Undo that result first.');
    }
  }
  m.scoreA = scoreA;
  m.scoreB = scoreB;
  m.winner = winner;
  m.status = 'done';
  if (winner) {
    const w: Slot = winner === 'a' ? m.a : m.b;
    const l: Slot = winner === 'a' ? m.b : m.a;
    put(map, m.winTo, w);
    put(map, m.loseTo, l);
  }
  // Grand final: if the losers-side finalist wins the first final, a reset is played; otherwise the reset is not needed.
  if (m.key === 'GF1') {
    const gf2 = map.get('GF2');
    if (gf2) {
      if (winner === 'b') {
        gf2.a = m.a;
        gf2.b = m.b;
        gf2.status = 'ready';
      } else {
        gf2.a = null;
        gf2.b = null;
        gf2.status = 'skipped';
      }
    }
  }
  return settle(matches);
}

// Take a result back (only when nothing after it was played).
export function undo(current: Match[], matchKey: string): Match[] {
  const matches = clone(current);
  const map = key(matches);
  const m = map.get(matchKey);
  if (!m || m.status !== 'done') throw new Error('That match has no result to undo.');
  for (const link of [m.winTo, m.loseTo]) {
    const t = link && map.get(link.key);
    if (t && t.status === 'done') throw new Error('The next match has already been played. Undo that result first.');
  }
  for (const link of [m.winTo, m.loseTo]) clearForward(map, link);
  m.scoreA = m.scoreB = m.winner = null;
  m.status = 'pending';
  if (m.key === 'GF1') {
    const gf2 = map.get('GF2');
    if (gf2) {
      gf2.a = gf2.b = null;
      gf2.status = 'pending';
    }
  }
  return settle(matches);
}

// Empty the slot a result had filled. If that match had settled as a bye because of it, its own onward moves are taken back too.
function clearForward(map: Map<string, Match>, link: Link | undefined) {
  const t = link && map.get(link.key);
  if (!t || !link) return;
  t[link.side] = null;
  if (t.status === 'bye') {
    t.status = 'pending';
    t.winner = null;
    clearForward(map, t.winTo);
    clearForward(map, t.loseTo);
  } else if (t.status === 'ready') t.status = 'pending';
}

export type Row = { id: string; played: number; wins: number; losses: number; draws: number; points: number; diff: number; buchholz: number };

// Standings for round robin and Swiss: match points (win 3, draw 1), then score difference, then (Swiss) the strength of opponents beaten.
export function standings(entrants: string[], matches: Match[]): Row[] {
  const rows = new Map<string, Row>(entrants.map((id) => [id, { id, played: 0, wins: 0, losses: 0, draws: 0, points: 0, diff: 0, buchholz: 0 }]));
  const opp = new Map<string, string[]>();
  for (const m of matches) {
    if (m.status !== 'done' || m.a === null || m.b === null || m.a === BYE || m.b === BYE) continue;
    const ra = rows.get(m.a);
    const rb = rows.get(m.b);
    if (!ra || !rb) continue;
    ra.played++;
    rb.played++;
    ra.diff += (m.scoreA ?? 0) - (m.scoreB ?? 0);
    rb.diff += (m.scoreB ?? 0) - (m.scoreA ?? 0);
    if (m.winner === 'a') {
      ra.wins++;
      rb.losses++;
      ra.points += 3;
    } else if (m.winner === 'b') {
      rb.wins++;
      ra.losses++;
      rb.points += 3;
    } else {
      ra.draws++;
      rb.draws++;
      ra.points++;
      rb.points++;
    }
    opp.set(m.a, [...(opp.get(m.a) ?? []), m.b]);
    opp.set(m.b, [...(opp.get(m.b) ?? []), m.a]);
  }
  for (const r of rows.values()) r.buchholz = (opp.get(r.id) ?? []).reduce((s, o) => s + (rows.get(o)?.points ?? 0), 0);
  return [...rows.values()].sort((x, y) => y.points - x.points || y.diff - x.diff || y.buchholz - x.buchholz || x.id.localeCompare(y.id));
}

// Swiss: the next round pairs people with the same record, never twice the same pair, and the odd one out gets a bye (counted as a 1-0 win, once each).
export function swissRound(entrants: string[], played: Match[], round: number): Match[] {
  const table = standings(entrants, played);
  const met = new Set<string>();
  const hadBye = new Set<string>();
  for (const m of played) {
    if (m.a && m.b && m.a !== BYE && m.b !== BYE) met.add([m.a, m.b].sort().join('|'));
    if (m.a === BYE && m.b && m.b !== BYE) hadBye.add(m.b);
    if (m.b === BYE && m.a && m.a !== BYE) hadBye.add(m.a);
  }
  const pool = table.map((r) => r.id);
  const out: Match[] = [];
  let bye: string | null = null;
  if (pool.length % 2) {
    const pick = [...pool].reverse().find((id) => !hadBye.has(id)) ?? pool[pool.length - 1];
    bye = pick;
    pool.splice(pool.indexOf(pick), 1);
  }
  const pair = (left: string[]): [string, string][] | null => {
    if (left.length === 0) return [];
    const [first, ...rest] = left;
    for (let i = 0; i < rest.length; i++) {
      if (met.has([first, rest[i]].sort().join('|'))) continue;
      const tail = pair([...rest.slice(0, i), ...rest.slice(i + 1)]);
      if (tail) return [[first, rest[i]], ...tail];
    }
    return null;
  };
  // If no clean pairing exists (too many rounds for the field), repeats are allowed rather than failing.
  const pairs = pair(pool) ?? pool.reduce<[string, string][]>((acc, id, i) => (i % 2 ? acc : [...acc, [id, pool[i + 1]]]), []);
  pairs.forEach(([x, y], i) => {
    const m = blank(`S${round}-${i + 1}`, 'S', round, i + 1);
    m.a = x;
    m.b = y;
    out.push(m);
  });
  if (bye) {
    const m = blank(`S${round}-${pairs.length + 1}`, 'S', round, pairs.length + 1);
    m.a = bye;
    m.b = BYE;
    out.push(m);
  }
  return out;
}

export function swissRounds(players: number): number {
  return Math.max(1, Math.ceil(Math.log2(players)));
}

// Who is still alive and how did people place (single and double elimination).
export function placements(matches: Match[]): { id: string; place: number }[] {
  const map = key(matches);
  const out: { id: string; place: number }[] = [];
  const real = (s: Slot): s is string => !!s && s !== BYE;
  const pick = (m: Match | undefined, side: 'win' | 'lose'): Slot => {
    if (!m || m.status !== 'done' || !m.winner) return null;
    const w = m.winner === 'a' ? m.a : m.b;
    const l = m.winner === 'a' ? m.b : m.a;
    return side === 'win' ? w : l;
  };
  const gf1 = map.get('GF1');
  const gf2 = map.get('GF2');
  if (gf1) {
    if (gf2 && gf2.status === 'ready') return out;
    const final = gf2 && gf2.status === 'done' ? gf2 : gf1;
    const champ = pick(final, 'win');
    const second = pick(final, 'lose');
    if (real(champ)) out.push({ id: champ, place: 1 });
    if (real(second)) out.push({ id: second, place: 2 });
    return out;
  }
  const rounds = Math.max(0, ...matches.filter((m) => m.bracket === 'W').map((m) => m.round));
  const final = map.get(`W${rounds}-1`);
  const champ = pick(final, 'win');
  const second = pick(final, 'lose');
  if (real(champ)) out.push({ id: champ, place: 1 });
  if (real(second)) out.push({ id: second, place: 2 });
  const third = map.get('T');
  const t3 = pick(third, 'win');
  const t4 = pick(third, 'lose');
  if (real(t3)) out.push({ id: t3, place: 3 });
  if (real(t4)) out.push({ id: t4, place: 4 });
  return out;
}
