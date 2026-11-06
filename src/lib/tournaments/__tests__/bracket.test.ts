import { describe, expect, it } from 'vitest';
import { BYE, generate, placements, report, seedOrder, standings, swissRound, swissRounds, undo, type Entrant, type Match } from '../bracket';

const field = (n: number): Entrant[] => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, seed: i + 1 }));
const find = (m: Match[], k: string) => m.find((x) => x.key === k)!;
// Play every ready match; the better seed (lower number) always wins.
function playAll(matches: Match[]): Match[] {
  let cur = matches;
  for (let guard = 0; guard < 500; guard++) {
    const m = cur.find((x) => x.status === 'ready');
    if (!m) break;
    const seed = (s: string | null) => Number(String(s).slice(1));
    cur = report(cur, m.key, seed(m.a) < seed(m.b) ? 2 : 0, seed(m.a) < seed(m.b) ? 0 : 2);
  }
  return cur;
}

describe('seedOrder', () => {
  it('puts 1 and 2 in opposite halves', () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('single elimination', () => {
  it('builds n-1 matches for a full field', () => {
    expect(generate('single', field(8))).toHaveLength(7);
  });
  it('gives byes to the top seeds when the field is not a power of 2', () => {
    const m = generate('single', field(6));
    const r1 = m.filter((x) => x.round === 1);
    expect(r1.filter((x) => x.status === 'bye')).toHaveLength(2);
    // seeds 1 and 2 skipped round one, so they are waiting in round two
    expect(find(m, 'W2-1').a).toBe('p1');
    expect(find(m, 'W2-2').a).toBe('p2');
  });
  it('plays through to a champion by seed', () => {
    const done = playAll(generate('single', field(7)));
    expect(placements(done)[0]).toEqual({ id: 'p1', place: 1 });
    expect(placements(done)[1]).toEqual({ id: 'p2', place: 2 });
  });
  it('has an optional third place match', () => {
    const done = playAll(generate('single', field(8), { thirdPlace: true }));
    expect(placements(done).map((p) => p.place)).toEqual([1, 2, 3, 4]);
  });
  it('refuses ties and matches that are not ready', () => {
    const m = generate('single', field(8));
    expect(() => report(m, 'W1-1', 1, 1)).toThrow(/winner/);
    expect(() => report(m, 'W2-1', 2, 0)).toThrow(/not ready/);
  });
  it('lets a result be corrected before the next match is played, but not after', () => {
    let m = generate('single', field(4));
    m = report(m, 'W1-1', 2, 0); // p1 beats p4
    m = report(m, 'W1-1', 0, 2); // corrected: p4 wins
    expect(find(m, 'W2-1').a).toBe('p4');
    m = report(m, 'W1-2', 2, 0);
    m = report(m, 'W2-1', 2, 0);
    expect(() => report(m, 'W1-1', 2, 0)).toThrow(/already been played/);
  });
  it('undoes a result and clears where it sent people', () => {
    let m = generate('single', field(4));
    m = report(m, 'W1-1', 2, 0);
    m = undo(m, 'W1-1');
    expect(find(m, 'W2-1').a).toBeNull();
    expect(find(m, 'W1-1').status).toBe('ready');
  });
  it('does not change the input', () => {
    const m = generate('single', field(4));
    const copy = JSON.stringify(m);
    report(m, 'W1-1', 2, 0);
    expect(JSON.stringify(m)).toBe(copy);
  });
});

describe('double elimination', () => {
  it('builds the right number of matches for 8 (14 + grand finals)', () => {
    const m = generate('double', field(8));
    expect(m.filter((x) => x.bracket === 'W')).toHaveLength(7);
    expect(m.filter((x) => x.bracket === 'L')).toHaveLength(6);
    expect(m.filter((x) => x.bracket === 'GF')).toHaveLength(2);
  });
  it('sends losers to the losers bracket', () => {
    let m = generate('double', field(4));
    m = report(m, 'W1-1', 2, 0); // p1 over p4
    m = report(m, 'W1-2', 2, 0); // p2 over p3
    expect(find(m, 'L1-1').a).toBe('p4');
    expect(find(m, 'L1-1').b).toBe('p3');
  });
  it('a player is out after two losses and the favorite wins everything', () => {
    for (const n of [3, 4, 5, 6, 8, 11, 16]) {
      const done = playAll(generate('double', field(n)));
      expect(placements(done)[0], `n=${n}`).toEqual({ id: 'p1', place: 1 });
      expect(find(done, 'GF2').status, `n=${n}`).toBe('skipped');
      // every real match reached a result
      expect(
        done.filter((x) => x.status === 'ready' || x.status === 'pending'),
        `n=${n}`,
      ).toHaveLength(0);
    }
  });
  it('plays a reset when the losers-side finalist wins the first final', () => {
    let m = generate('double', field(2));
    // two players: no losers bracket, so just check the reset logic with four
    m = generate('double', field(4));
    m = report(m, 'W1-1', 2, 0);
    m = report(m, 'W1-2', 2, 0);
    m = report(m, 'W2-1', 2, 0); // p1 to the grand final
    m = report(m, 'L1-1', 2, 0); // p4 beats p3
    m = report(m, 'L2-1', 0, 2); // p4 beats p2 (loser of W2)... p2 dropped in as b
    expect(find(m, 'GF1').b).toBeTruthy();
    const challenger = find(m, 'GF1').b as string;
    m = report(m, 'GF1', 0, 2); // the losers-side finalist wins
    expect(find(m, 'GF2').status).toBe('ready');
    expect(placements(m)).toEqual([]); // not decided until the reset is played
    m = report(m, 'GF2', 0, 2);
    expect(placements(m)[0].id).toBe(challenger);
  });
});

describe('round robin', () => {
  it('everyone plays everyone once', () => {
    const m = generate('roundrobin', field(5));
    const real = m.filter((x) => x.status !== 'bye');
    expect(real).toHaveLength(10);
    const pairs = new Set(real.map((x) => [x.a, x.b].sort().join('|')));
    expect(pairs.size).toBe(10);
  });
  it('ranks by match points and allows draws when asked', () => {
    let m = generate('roundrobin', field(4));
    for (const x of m.filter((y) => y.status === 'ready')) m = report(m, x.key, 1, 1, { allowTie: true });
    const t = standings(
      field(4).map((e) => e.id),
      m,
    );
    expect(t.every((r) => r.points === 3 && r.draws === 3)).toBe(true);
  });
});

describe('swiss', () => {
  it('pairs by record, never repeats, and gives the odd player a bye', () => {
    const ids = field(5).map((e) => e.id);
    let all: Match[] = [];
    for (let r = 1; r <= swissRounds(5); r++) {
      let round = swissRound(ids, all, r);
      round = round.map((x) => ({ ...x }));
      for (const x of round) {
        if (x.b === BYE) {
          x.status = 'done';
          x.winner = 'a';
          x.scoreA = 1;
          x.scoreB = 0;
        } else {
          x.status = 'done';
          x.winner = 'a';
          x.scoreA = 2;
          x.scoreB = 0;
        }
      }
      all = [...all, ...round];
    }
    const pairs = all.filter((x) => x.b !== BYE).map((x) => [x.a, x.b].sort().join('|'));
    expect(new Set(pairs).size).toBe(pairs.length);
    const byes = all.filter((x) => x.b === BYE).map((x) => x.a);
    expect(new Set(byes).size).toBe(byes.length);
  });
  it('plays ceil(log2 n) rounds', () => {
    expect(swissRounds(8)).toBe(3);
    expect(swissRounds(9)).toBe(4);
  });
});
