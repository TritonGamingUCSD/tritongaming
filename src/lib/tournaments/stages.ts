import { BYE, generate, swissRound, swissRounds, type Entrant, type Match } from './bracket';

// A tournament is one or more STAGES played in order (pools, then a bracket; Swiss, then a top cut; a round robin final). Each stage has a format, its own settings, and a rule for who moves on to the next one.
// Everything here is pure: it builds a stage's matches, ranks the people in it, and says who advances. The database and screens only store and show the result.
export type StageFormat = 'single' | 'double' | 'roundrobin' | 'swiss' | 'points' | 'custom';
export type Tiebreak = 'wins' | 'diff' | 'h2h' | 'buchholz' | 'seed';

export interface StageSettings {
  best_of?: number; // 1, 3, 5, 7 (a match is first to ceil(n/2))
  third_place?: boolean; // single elimination
  grand_final_reset?: boolean; // double elimination: play the reset when the losers-side finalist wins the first final (default on)
  swiss_rounds?: number; // default ceil(log2 players)
  group_count?: number; // round robin split into pools (default 1)
  seeding?: 'seed' | 'random'; // how entrants are placed in pools
  tiebreakers?: Tiebreak[]; // after match points
  scoring?: { win: number; draw: number; loss: number }; // match points (default 3 / 1 / 0)
  points_table?: number[]; // points stage: points for 1st, 2nd, 3rd...
  heat_size?: number; // points stage: players per heat
  rounds?: number; // points stage: number of rounds
}

// Who moves on from a stage. 'top' with per_group keeps the top N of each pool; without it the top N overall.
export interface Advance {
  mode: 'none' | 'all' | 'top';
  count?: number;
  per_group?: boolean;
}

export interface StageDef {
  format: StageFormat;
  settings: StageSettings;
  advance: Advance;
}

export const DEFAULT_SCORING = { win: 3, draw: 1, loss: 0 } as const;
export const DEFAULT_TIEBREAKS: Tiebreak[] = ['wins', 'diff', 'h2h', 'buchholz', 'seed'];

// Pool assignment: snake order (1→A, 2→B, 3→C, 4→C, 5→B, 6→A, 7→A ...) so every pool has the same strength, or a shuffle.
export function splitIntoGroups(entrants: Entrant[], groups: number, seeding: 'seed' | 'random' = 'seed', rand: () => number = Math.random): Entrant[][] {
  const sorted = [...entrants].sort((a, b) => a.seed - b.seed);
  const list = seeding === 'random' ? [...sorted].sort(() => rand() - 0.5) : sorted;
  const out: Entrant[][] = Array.from({ length: Math.max(1, groups) }, () => []);
  list.forEach((e, i) => {
    const row = Math.floor(i / out.length);
    const col = i % out.length;
    out[row % 2 === 0 ? col : out.length - 1 - col].push(e);
  });
  return out;
}

const prefix = (m: Match, g: number): Match => ({
  ...m,
  key: `G${g}.${m.key}`,
  group: g,
  winTo: m.winTo && { ...m.winTo, key: `G${g}.${m.winTo.key}` },
  loseTo: m.loseTo && { ...m.loseTo, key: `G${g}.${m.loseTo.key}` },
});

// The matches a stage starts with. Pools are a round robin per group (keys G1.RR1-1 ...). A Swiss stage starts with round 1 only; later rounds are dealt on request. 'points' and 'custom' start empty (heats and hand-made matches are added as they are played).
export function buildStage(def: StageDef, entrants: Entrant[], groupsOverride?: Entrant[][]): Match[] {
  const s = def.settings;
  if (def.format === 'single') return generate('single', entrants, { thirdPlace: !!s.third_place });
  if (def.format === 'double') return generate('double', entrants, { grandFinalReset: s.grand_final_reset !== false });
  if (def.format === 'swiss') return generate('swiss', entrants);
  if (def.format === 'roundrobin') {
    const groups = groupsOverride ?? splitIntoGroups(entrants, s.group_count ?? 1, s.seeding ?? 'seed');
    return groups.flatMap((g, i) => (g.length >= 2 ? generate('roundrobin', g).map((m) => prefix(m, i + 1)) : []));
  }
  return [];
}

export function groupsOf(matches: Match[]): number[] {
  return [...new Set(matches.filter((m) => m.group).map((m) => m.group as number))].sort((a, b) => a - b);
}

export type Row = { id: string; played: number; wins: number; losses: number; draws: number; points: number; diff: number; buchholz: number; seed: number };

// Standings for round robin pools and Swiss: match points (win/draw/loss from the stage settings), then the tiebreakers in order. 'h2h' only settles a tie between two people by their own match.
export function rank(ids: string[], matches: Match[], settings: StageSettings = {}, seeds: Map<string, number> = new Map()): Row[] {
  const sc = { ...DEFAULT_SCORING, ...(settings.scoring ?? {}) };
  const rows = new Map<string, Row>(ids.map((id) => [id, { id, played: 0, wins: 0, losses: 0, draws: 0, points: 0, diff: 0, buchholz: 0, seed: seeds.get(id) ?? 1e9 }]));
  const opp = new Map<string, string[]>();
  const h2h = new Map<string, number>(); // "a|b" -> +1 if a beat b
  for (const m of matches) {
    if (m.status !== 'done' || !m.a || !m.b || m.a === BYE || m.b === BYE) continue;
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
      ra.points += sc.win;
      rb.points += sc.loss;
      h2h.set(`${m.a}|${m.b}`, 1);
      h2h.set(`${m.b}|${m.a}`, -1);
    } else if (m.winner === 'b') {
      rb.wins++;
      ra.losses++;
      rb.points += sc.win;
      ra.points += sc.loss;
      h2h.set(`${m.b}|${m.a}`, 1);
      h2h.set(`${m.a}|${m.b}`, -1);
    } else {
      ra.draws++;
      rb.draws++;
      ra.points += sc.draw;
      rb.points += sc.draw;
    }
    opp.set(m.a, [...(opp.get(m.a) ?? []), m.b]);
    opp.set(m.b, [...(opp.get(m.b) ?? []), m.a]);
  }
  for (const r of rows.values()) r.buchholz = (opp.get(r.id) ?? []).reduce((n, o) => n + (rows.get(o)?.points ?? 0), 0);
  const order = settings.tiebreakers?.length ? settings.tiebreakers : DEFAULT_TIEBREAKS;
  const cmp = (x: Row, y: Row): number => {
    if (y.points !== x.points) return y.points - x.points;
    for (const t of order) {
      let d = 0;
      if (t === 'wins') d = y.wins - x.wins;
      else if (t === 'diff') d = y.diff - x.diff;
      else if (t === 'buchholz') d = y.buchholz - x.buchholz;
      else if (t === 'h2h') d = -(h2h.get(`${x.id}|${y.id}`) ?? 0);
      else if (t === 'seed') d = x.seed - y.seed;
      if (d !== 0) return d;
    }
    return x.id.localeCompare(y.id);
  };
  return [...rows.values()].sort(cmp);
}

// Where everyone finished in an elimination bracket: 1st, 2nd, then everyone knocked out at the same point shares a place (two semifinal losers share 3rd unless there is a third-place match).
export function eliminationRanking(entrants: string[], matches: Match[]): { id: string; place: number }[] {
  const out = new Map<string, number>(); // elimination order: bigger = later
  const real = (s: string | null): s is string => !!s && s !== BYE;
  const key = (m: Match) => (m.bracket === 'GF' ? 1000 + m.round : m.bracket === 'L' ? 100 + m.round : m.bracket === 'W' ? m.round : 0);
  const hasL = matches.some((m) => m.bracket === 'L');
  for (const m of matches) {
    if (m.status !== 'done' || !m.winner || m.bracket === 'T' || m.bracket === 'RR' || m.bracket === 'S') continue;
    const loser = m.winner === 'a' ? m.b : m.a;
    if (!real(loser)) continue;
    // In double elimination a loss in the winners bracket only drops you; the loss that counts is in the losers bracket or the final.
    if (hasL && m.bracket === 'W') continue;
    out.set(loser, Math.max(out.get(loser) ?? 0, key(m)));
  }
  const gf2 = matches.find((m) => m.key === 'GF2' && m.status === 'done');
  const gf1 = matches.find((m) => m.key === 'GF1' && m.status === 'done');
  const finalM = gf2 ?? gf1 ?? matches.filter((m) => m.bracket === 'W').sort((x, y) => y.round - x.round)[0];
  const champ = finalM && finalM.status === 'done' && finalM.winner ? (finalM.winner === 'a' ? finalM.a : finalM.b) : null;
  const ranked: { id: string; place: number }[] = [];
  if (real(champ)) {
    out.delete(champ);
    ranked.push({ id: champ, place: 1 });
  }
  const t = matches.find((m) => m.bracket === 'T' && m.status === 'done');
  const entries = [...out.entries()].sort((a, b) => b[1] - a[1]);
  let place = ranked.length + 1;
  for (let i = 0; i < entries.length;) {
    let j = i;
    while (j < entries.length && entries[j][1] === entries[i][1]) j++;
    for (let k = i; k < j; k++) ranked.push({ id: entries[k][0], place });
    place += j - i;
    i = j;
  }
  if (t && t.winner) {
    const w = t.winner === 'a' ? t.a : t.b;
    const l = t.winner === 'a' ? t.b : t.a;
    for (const r of ranked) {
      if (r.id === w) r.place = 3;
      if (r.id === l) r.place = 4;
    }
  }
  const have = new Set(ranked.map((r) => r.id));
  void entrants.filter((e) => !have.has(e));
  return ranked.sort((a, b) => a.place - b.place);
}

// The standing of everyone in a finished (or running) stage, as an ordered list: pools are ranked inside each pool, then pool by pool.
export type Ranked = { id: string; place: number; group?: number };
export function stageRanking(def: StageDef, entrants: Entrant[], matches: Match[]): Ranked[] {
  const seeds = new Map(entrants.map((e) => [e.id, e.seed]));
  if (def.format === 'single' || def.format === 'double')
    return eliminationRanking(
      entrants.map((e) => e.id),
      matches,
    );
  if (def.format === 'roundrobin') {
    return groupsOf(matches).flatMap((g) => {
      const inGroup = matches.filter((m) => m.group === g);
      const ids = [...new Set(inGroup.flatMap((m) => [m.a, m.b]).filter((x): x is string => !!x && x !== BYE))];
      return rank(ids, inGroup, def.settings, seeds).map((r, i) => ({ id: r.id, place: i + 1, group: g }));
    });
  }
  if (def.format === 'swiss' || def.format === 'custom')
    return rank(
      entrants.map((e) => e.id),
      matches,
      def.settings,
      seeds,
    ).map((r, i) => ({ id: r.id, place: i + 1 }));
  return [];
}

// Who moves on, in the order they are seeded into the next stage. Per pool: all the pool winners first (best first), then all the runners-up, and so on; the runners-up order is shifted so a pool winner does not meet their own pool's runner-up in round one.
export function qualifiers(def: StageDef, ranking: Ranked[]): string[] {
  const a = def.advance;
  if (a.mode === 'none') return [];
  if (a.mode === 'all') return ranking.map((r) => r.id);
  const n = Math.max(1, a.count ?? 1);
  if (a.per_group && ranking.some((r) => r.group)) {
    const groups = [...new Set(ranking.map((r) => r.group as number))].sort((x, y) => x - y);
    const out: string[] = [];
    for (let p = 1; p <= n; p++) {
      let row = groups.map((g) => ranking.find((r) => r.group === g && r.place === p)?.id).filter((x): x is string => !!x);
      if (p % 2 === 0) row = row.flatMap((_, i) => (i % 2 === 0 ? [row[i + 1], row[i]].filter((x): x is string => !!x) : []));
      out.push(...row);
    }
    return out;
  }
  return [...ranking]
    .sort((x, y) => x.place - y.place)
    .slice(0, n)
    .map((r) => r.id);
}

// How many people a stage sends on, for the preview before anything is played.
export function advanceSize(def: StageDef, players: number): number {
  const a = def.advance;
  if (a.mode === 'none') return 0;
  if (a.mode === 'all') return players;
  const n = Math.max(1, a.count ?? 1);
  if (a.per_group && def.format === 'roundrobin') {
    const g = Math.max(1, def.settings.group_count ?? 1);
    return splitIntoGroups(
      Array.from({ length: players }, (_, i) => ({ id: String(i), seed: i + 1 })),
      g,
    ).reduce((t, grp) => t + Math.min(n, grp.length), 0);
  }
  return Math.min(n, players);
}

// A stage is finished when none of its matches is waiting (a Swiss stage also needs its last round dealt, a points stage its last round).
export function stageComplete(def: StageDef, entrantCount: number, matches: Match[]): boolean {
  if (matches.length === 0) return false;
  if (matches.some((m) => m.status === 'ready' || m.status === 'pending')) return false;
  if (def.format === 'swiss') return Math.max(...matches.map((m) => m.round)) >= (def.settings.swiss_rounds ?? swissRounds(entrantCount));
  return true;
}

export const dealSwiss = swissRound;

// What a stage will produce, for the "preview" while an organizer sets it up: how many players, pools, matches and rounds, with no database involved.
export function describeStage(def: StageDef, players: number): { matches: number; rounds: number; note: string } {
  const n = Math.max(0, players);
  const s = def.settings;
  const bo = s.best_of && s.best_of > 1 ? `, best of ${s.best_of}` : '';
  if (n < 2) return { matches: 0, rounds: 0, note: 'Needs at least 2 players' };
  const pow = (x: number) => {
    let p = 2;
    while (p < x) p *= 2;
    return p;
  };
  if (def.format === 'single') return { matches: n - 1 + (s.third_place && n >= 4 ? 1 : 0), rounds: Math.log2(pow(n)), note: `${n} players${bo}` };
  if (def.format === 'double')
    return { matches: 2 * n - 2 + (s.grand_final_reset === false ? 0 : 1), rounds: Math.log2(pow(n)) * 2, note: `${n} players${bo}, one more loss and you are out` };
  if (def.format === 'roundrobin') {
    const g = Math.max(1, s.group_count ?? 1);
    const sizes = splitIntoGroups(
      Array.from({ length: n }, (_, i) => ({ id: String(i), seed: i + 1 })),
      g,
    ).map((x) => x.length);
    return {
      matches: sizes.reduce((t, k) => t + (k * (k - 1)) / 2, 0),
      rounds: Math.max(...sizes) - (Math.max(...sizes) % 2 ? 0 : 1),
      note: g > 1 ? `${g} pools of ${sizes.join(' / ')}${bo}` : `everyone plays everyone${bo}`,
    };
  }
  if (def.format === 'swiss') {
    const r = s.swiss_rounds ?? swissRounds(n);
    return { matches: r * Math.floor(n / 2), rounds: r, note: `${r} rounds${bo}` };
  }
  if (def.format === 'points') {
    const r = s.rounds ?? 3;
    const size = s.heat_size ?? 4;
    return { matches: r * Math.ceil(n / size), rounds: r, note: `${r} rounds of heats with ${size} per heat` };
  }
  return { matches: 0, rounds: 0, note: 'Matches are added by hand' };
}

// Ready-made structures, so setting up a common format is one click. Each is a list of stages.
export interface Template {
  id: string;
  name: string;
  about: string;
  stages: { name: string; def: StageDef }[];
}
const st = (format: StageFormat, settings: StageSettings = {}, advance: Advance = { mode: 'none' }): StageDef => ({ format, settings, advance });
export const TEMPLATES: Template[] = [
  { id: 'single', name: 'Single elimination', about: 'Lose once and you are out.', stages: [{ name: 'Bracket', def: st('single') }] },
  { id: 'double', name: 'Double elimination', about: 'Out after two losses, with a grand final.', stages: [{ name: 'Bracket', def: st('double') }] },
  { id: 'roundrobin', name: 'Round robin', about: 'Everyone plays everyone.', stages: [{ name: 'Round robin', def: st('roundrobin') }] },
  { id: 'swiss', name: 'Swiss', about: 'A few rounds, paired by record.', stages: [{ name: 'Swiss', def: st('swiss') }] },
  {
    id: 'pools',
    name: 'Pools then bracket',
    about: 'Round robin pools; the top of each pool moves into a double elimination bracket.',
    stages: [
      { name: 'Pools', def: st('roundrobin', { group_count: 4 }, { mode: 'top', count: 2, per_group: true }) },
      { name: 'Bracket', def: st('double') },
    ],
  },
  {
    id: 'swiss-cut',
    name: 'Swiss then top cut',
    about: 'Swiss rounds, then the top 8 play a single elimination bracket.',
    stages: [
      { name: 'Swiss', def: st('swiss', {}, { mode: 'top', count: 8 }) },
      { name: 'Top cut', def: st('single') },
    ],
  },
  {
    id: 'points',
    name: 'Points series (free for all)',
    about: 'Heats of several players; placements earn points over the rounds.',
    stages: [{ name: 'Series', def: st('points', { rounds: 3, heat_size: 4, points_table: [10, 6, 4, 2] }) }],
  },
  { id: 'custom', name: 'Custom', about: 'Start empty and add matches by hand.', stages: [{ name: 'Stage 1', def: st('custom') }] },
];
