import { describe, expect, it } from 'vitest';
import { generate, report, type Entrant, type Match } from '../bracket';
import { buildStage, describeStage, qualifiers, rank, splitIntoGroups, stageComplete, stageRanking, TEMPLATES, type StageDef } from '../stages';

const field = (n: number): Entrant[] => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, seed: i + 1 }));
const seedOf = (s: string | null) => Number(String(s).slice(1));
function playAll(matches: Match[]): Match[] {
  let cur = matches;
  for (let g = 0; g < 500; g++) {
    const m = cur.find((x) => x.status === 'ready');
    if (!m) break;
    cur = report(cur, m.key, seedOf(m.a) < seedOf(m.b) ? 2 : 0, seedOf(m.a) < seedOf(m.b) ? 0 : 2, { allowTie: false });
  }
  return cur;
}
const def = (format: StageDef['format'], settings = {}, advance: StageDef['advance'] = { mode: 'none' }): StageDef => ({ format, settings, advance });

describe('pools', () => {
  it('snake seeding gives every pool the same strength', () => {
    const g = splitIntoGroups(field(8), 2);
    expect(g[0].map((e) => e.id)).toEqual(['p1', 'p4', 'p5', 'p8']);
    expect(g[1].map((e) => e.id)).toEqual(['p2', 'p3', 'p6', 'p7']);
  });
  it('builds a round robin per pool with prefixed keys', () => {
    const m = buildStage(def('roundrobin', { group_count: 2 }), field(8));
    expect(m.filter((x) => x.group === 1)).toHaveLength(6);
    expect(m.filter((x) => x.group === 2)).toHaveLength(6);
    expect(m[0].key.startsWith('G1.RR')).toBe(true);
  });
  it('ranks inside each pool and takes the top of each pool', () => {
    const d = def('roundrobin', { group_count: 2 }, { mode: 'top', count: 2, per_group: true });
    const done = playAll(buildStage(d, field(8)));
    const ranking = stageRanking(d, field(8), done);
    const q = qualifiers(d, ranking);
    expect(q).toHaveLength(4);
    // pool winners first: p1 (pool 1) and p2 (pool 2); runners-up after, shifted so they do not meet their own pool winner
    expect(q.slice(0, 2).sort()).toEqual(['p1', 'p2']);
    expect(q.slice(2).sort()).toEqual(['p3', 'p4']);
    expect(q[2]).toBe('p3'); // runner-up of pool 2 comes first
  });
});

describe('ranking', () => {
  it('uses the scoring and tiebreakers from the settings', () => {
    let m = generate('roundrobin', field(3));
    for (const x of m.filter((y) => y.status === 'ready')) m = report(m, x.key, 1, 1, { allowTie: true });
    const rows = rank(
      ['p1', 'p2', 'p3'],
      m,
      { scoring: { win: 3, draw: 1, loss: 0 }, tiebreakers: ['seed'] },
      new Map([
        ['p1', 1],
        ['p2', 2],
        ['p3', 3],
      ]),
    );
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(rows.every((r) => r.points === 2)).toBe(true);
  });
  it('places an elimination bracket: 1st, 2nd, and shared places for each knockout round', () => {
    const done = playAll(generate('single', field(8)));
    const places = stageRanking(def('single'), field(8), done);
    expect(places.find((p) => p.id === 'p1')?.place).toBe(1);
    expect(places.find((p) => p.id === 'p2')?.place).toBe(2);
    expect(places.filter((p) => p.place === 3)).toHaveLength(2);
    expect(places.filter((p) => p.place === 5)).toHaveLength(4);
  });
  it('places a double elimination bracket from the losers bracket', () => {
    const done = playAll(generate('double', field(8)));
    const places = stageRanking(def('double'), field(8), done);
    expect(places[0]).toEqual({ id: 'p1', place: 1 });
    expect(places[1]).toEqual({ id: 'p2', place: 2 });
    expect(places.find((p) => p.id === 'p3')?.place).toBe(3);
  });
  it('a grand final without a reset has no second final', () => {
    const m = buildStage(def('double', { grand_final_reset: false }), field(4));
    expect(m.find((x) => x.key === 'GF2')).toBeUndefined();
  });
});

describe('moving on', () => {
  it('top N overall for Swiss or elimination', () => {
    const d = def('swiss', {}, { mode: 'top', count: 3 });
    expect(
      qualifiers(
        d,
        [1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, place: n })),
      ),
    ).toEqual(['p1', 'p2', 'p3']);
  });
  it('everyone moves on with mode all, nobody with none', () => {
    const r = [
      { id: 'a', place: 1 },
      { id: 'b', place: 2 },
    ];
    expect(qualifiers(def('single', {}, { mode: 'all' }), r)).toEqual(['a', 'b']);
    expect(qualifiers(def('single'), r)).toEqual([]);
  });
  it('knows when a stage is finished', () => {
    const m = generate('single', field(4));
    expect(stageComplete(def('single'), 4, m)).toBe(false);
    expect(stageComplete(def('single'), 4, playAll(m))).toBe(true);
  });
});

describe('describing a stage', () => {
  it('counts matches for the live preview', () => {
    expect(describeStage(def('single'), 16).matches).toBe(15);
    expect(describeStage(def('single', { third_place: true }), 16).matches).toBe(16);
    expect(describeStage(def('double'), 8).matches).toBe(15);
    expect(describeStage(def('roundrobin', { group_count: 4 }), 16).matches).toBe(24);
    expect(describeStage(def('swiss'), 16).rounds).toBe(4);
  });
  it('every template builds', () => {
    for (const t of TEMPLATES) {
      for (const s of t.stages) expect(() => buildStage(s.def, field(8))).not.toThrow();
    }
  });
});
