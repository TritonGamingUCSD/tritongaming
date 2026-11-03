import { describe, expect, it } from 'vitest';
import { canEnter, cleanRules, NO_RULES, rulesEmpty } from '@/lib/staffle/rules';
import { draw, oddsOf, rankByValue, ranksFor } from '@/lib/staffle/draw';

const A = '00000000-0000-4000-8000-00000000000a',
  B = '00000000-0000-4000-8000-00000000000b';
const officer = { id: 'o', roles: ['officer'], marks: 0 },
  recruit = { id: 'r', roles: ['recruit'], marks: 0 };

describe('who may enter', () => {
  it('the whole team by default', () => {
    expect(canEnter(NO_RULES, officer).ok).toBe(true);
    expect(canEnter(NO_RULES, recruit).ok).toBe(true);
    expect(canEnter(NO_RULES, { id: 's', roles: ['ucsd'], marks: 0 }).ok).toBe(false);
  });
  it('only the roles ticked', () => {
    const rules = { ...NO_RULES, roles: ['officer' as const] };
    expect(canEnter(rules, recruit).ok).toBe(false);
    expect(canEnter(rules, officer).ok).toBe(true);
  });
  it('a person picked by name is in, even without the role', () => {
    expect(canEnter({ ...NO_RULES, roles: ['officer'], people: ['r'] }, recruit).ok).toBe(true);
    expect(canEnter({ ...NO_RULES, roles: [], people: ['o'] }, officer).ok).toBe(true);
  });
  it('inactive members never enter, not even by name; a role does not pull in alumni, a name does', () => {
    const idle = { id: 'x', roles: ['officer', 'inactive'], marks: 0 };
    expect(canEnter(NO_RULES, idle).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, roles: ['officer'], people: ['x'] }, idle).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, people: ['a'] }, { id: 'a', roles: ['alumni'], marks: 0 }).ok).toBe(true);
    expect(canEnter(NO_RULES, { id: 'a', roles: ['alumni', 'officer'], marks: 0 }).ok).toBe(false);
  });
  it('strikes, warnings and named people can be left out', () => {
    const strike = { id: 's', roles: ['officer'], marks: 2 },
      warned = { id: 'w', roles: ['officer'], marks: 1 };
    expect(canEnter({ ...NO_RULES, skip: ['strike'] }, strike).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, skip: ['strike'] }, warned).ok).toBe(true);
    expect(canEnter({ ...NO_RULES, skip: ['warning'] }, warned).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, skip: ['strike', 'warning'] }, officer).ok).toBe(true);
    expect(canEnter({ ...NO_RULES, block: ['o'] }, officer).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, people: ['o'], block: ['o'] }, officer).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, people: ['s'], skip: ['strike'] }, strike).ok).toBe(true);
  });
  it('says why in words', () => {
    const r = canEnter({ ...NO_RULES, roles: ['officer'] }, recruit);
    expect(r.ok === false && r.why).toMatch(/only open to officers/);
  });
  it('needs someone who can enter', () => {
    expect(rulesEmpty({ ...NO_RULES, roles: [] })).toBe(true);
    expect(rulesEmpty({ ...NO_RULES, roles: [], people: [A] })).toBe(false);
  });
  it('cleans what a client sent', () => {
    expect(cleanRules({ roles: ['officer', 'nonsense', 'officer'], people: [A, 'bad', A, B] })).toEqual({ ...NO_RULES, roles: ['officer'], people: [A, B] });
    expect(cleanRules(null)).toEqual({ roles: [], people: [], skip: [], block: [] });
  });
});

describe('the draw', () => {
  const items = [
    { id: 'i1', winners: 1, entrants: ['a', 'b', 'c'] },
    { id: 'i2', winners: 2, entrants: ['a', 'b', 'c', 'd'] },
    { id: 'i3', winners: 1, entrants: ['a'] },
  ];
  it('is the same for the same seed', () => {
    expect(draw(items, 'seed-1')).toEqual(draw(items, 'seed-1'));
  });
  it('different seeds give different winners', () => {
    const results = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(draw(items, `s${i}`).won.map((w) => [w.item_id, w.user_id]))));
    expect(results.size).toBeGreaterThan(1);
  });
  it('nobody wins twice (except a prize only they entered), and an item gets as many winners as it asks for (or fewer when fewer entered)', () => {
    for (let i = 0; i < 40; i++) {
      const { won } = draw(items, `x${i}`);
      const people = won.filter((w) => w.item_id !== 'i3').map((w) => w.user_id);
      expect(new Set(people).size).toBe(people.length);
      expect(won.filter((w) => w.item_id === 'i2').length).toBeLessThanOrEqual(2);
      expect(won.every((w, k) => w.position === k)).toBe(true);
      for (const w of won) expect(items.find((it) => it.id === w.item_id)!.entrants).toContain(w.user_id);
    }
  });
  it('an item nobody entered has no winners when there are no leftover pools', () => {
    expect(draw([{ id: 'x', winners: 3, entrants: [] }], 's').won).toEqual([]);
  });
  it('people who already won are left out', () => {
    expect(draw([{ id: 'x', winners: 1, entrants: ['a', 'b'] }], 's', ['a']).won.map((w) => w.user_id)).toEqual(['b']);
  });
  it('a prize only one person entered goes to them, even if they entered others too', () => {
    for (let i = 0; i < 40; i++) {
      const { won } = draw(items, `solo${i}`);
      expect(won.find((w) => w.item_id === 'i3')?.user_id).toBe('a');
    }
  });
  it('a prize only one person entered is theirs even when they also win another prize, and it does not cost them the other one', () => {
    const two = [
      { id: 'solo', winners: 1, entrants: ['a'], rank: 1 },
      { id: 'big', winners: 1, entrants: ['a', 'b'], rank: 2 },
    ];
    const results = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const { won } = draw(two, `both${i}`);
      expect(won.find((w) => w.item_id === 'solo')?.user_id).toBe('a');
      results.add(won.find((w) => w.item_id === 'big')!.user_id);
    }
    expect(results).toEqual(new Set(['a', 'b'])); // a still has a fair chance at the contested prize
  });
  it('a sole entrant who was left out by name does not get the prize', () => {
    expect(draw([{ id: 'solo', winners: 1, entrants: ['a'] }], 's', ['a']).won).toEqual([]);
  });
  it('a sole entrant takes one spot of a prize with several winners, the rest open up for others', () => {
    const { won } = draw([{ id: 'x', winners: 3, entrants: ['a'] }], 's', [], { everyone: ['a', 'b', 'c'] });
    expect(won.filter((w) => w.user_id === 'a' && w.via === 'entered')).toHaveLength(1);
    expect(won.filter((w) => w.item_id === 'x')).toHaveLength(3);
  });
  describe('when everyone who entered a prize already won something', () => {
    it('two winners, both entrants already won: both still win it, not someone who did not enter', () => {
      for (let i = 0; i < 30; i++) {
        const { won } = draw(
          [
            { id: 'v1', winners: 1, rank: 1, entrants: ['a', 'z'] },
            { id: 'v2', winners: 1, rank: 1, entrants: ['b', 'y'] },
            { id: 'cheap', winners: 2, rank: 2, entrants: ['a', 'b'] },
          ],
          `d${i}`,
          [],
          { everyone: ['a', 'b', 'y', 'z', 'p'] },
        );
        const cheap = won.filter((w) => w.item_id === 'cheap');
        // both entrants win it (those who won a big prize get it as a second one), and never the outsider p
        expect(cheap.map((w) => w.user_id).sort()).toEqual(['a', 'b']);
        expect(cheap.every((w) => w.via === 'entered')).toBe(true);
        expect(cheap.some((w) => w.user_id === 'p')).toBe(false);
      }
    });
    it('one winner, two entrants who both already won: one of them gets it, not an outsider', () => {
      for (let i = 0; i < 30; i++) {
        const { won } = draw(
          [
            { id: 'v1', winners: 1, rank: 1, entrants: ['a', 'z'] },
            { id: 'v2', winners: 1, rank: 1, entrants: ['b', 'y'] },
            { id: 'cheap', winners: 1, rank: 2, entrants: ['a', 'b'] },
          ],
          `e${i}`,
          [],
          { everyone: ['a', 'b', 'y', 'z', 'p'] },
        );
        const cheap = won.filter((w) => w.item_id === 'cheap');
        expect(cheap).toHaveLength(1);
        expect(['a', 'b']).toContain(cheap[0].user_id);
        expect(cheap[0].via).toBe('entered');
      }
    });
    it('the entrant with the fewest wins gets it first', () => {
      for (let i = 0; i < 30; i++) {
        const { won } = draw(
          [
            { id: 'v1', winners: 1, rank: 1, entrants: ['a'] }, // sole: a wins it without using up their prize
            { id: 'v2', winners: 1, rank: 1, entrants: ['a', 'b'] },
            { id: 'v3', winners: 1, rank: 1, entrants: ['b', 'c'] },
            { id: 'cheap', winners: 1, rank: 2, entrants: ['a', 'b', 'c'] },
          ],
          `f${i}`,
        );
        const winnerOfCheap = won.find((w) => w.item_id === 'cheap')!.user_id;
        const count = (u: string) => won.filter((w) => w.user_id === u && w.item_id !== 'cheap').length;
        // the cheap prize never goes to someone with more wins than another entrant who could have had it
        for (const u of ['a', 'b', 'c']) expect(count(winnerOfCheap)).toBeLessThanOrEqual(count(u));
      }
    });
  });
  it('when fewer entered than there are winners, they all win it', () => {
    const { won } = draw([{ id: 'x', winners: 3, entrants: ['a', 'b'] }], 's');
    expect(won.map((w) => w.user_id).sort()).toEqual(['a', 'b']);
  });
  it('the least contested prize is drawn first, so it is not lost to a more popular one', () => {
    // b entered both; the rare prize (only a and b) is drawn before the popular one (everyone), so it is filled from a and b
    const two = [
      { id: 'popular', winners: 1, entrants: ['a', 'b', 'c', 'd', 'e', 'f'] },
      { id: 'rare', winners: 2, entrants: ['a', 'b'] },
    ];
    for (let i = 0; i < 30; i++) {
      const { won } = draw(two, `r${i}`);
      expect(
        won
          .filter((w) => w.item_id === 'rare')
          .map((w) => w.user_id)
          .sort(),
      ).toEqual(['a', 'b']);
      expect(won.find((w) => w.item_id === 'popular')?.user_id).toMatch(/[cdef]/);
    }
  });
  describe('draw order', () => {
    it('a person who entered a cheap rare prize and a valuable popular one still has a chance at the valuable one', () => {
      let a = 0;
      for (let i = 0; i < 400; i++) {
        const { won } = draw(
          [
            { id: 'valuable', winners: 1, rank: 1, entrants: ['a', 'b', 'c', 'd'] },
            { id: 'cheap', winners: 1, rank: 2, entrants: ['a'] },
          ],
          `v${i}`,
        );
        if (won.find((w) => w.item_id === 'valuable')?.user_id === 'a') a++;
      }
      expect(a).toBeGreaterThan(60); // about 1 in 4 (100 of 400)
    });
    it('and whether or not they win it they get the cheap one, which only they entered', () => {
      for (let i = 0; i < 60; i++) {
        const { won } = draw(
          [
            { id: 'valuable', winners: 1, rank: 1, entrants: ['a', 'b', 'c'] },
            { id: 'cheap', winners: 1, rank: 2, entrants: ['a'] },
          ],
          `w${i}`,
        );
        expect(won.find((w) => w.item_id === 'cheap')?.user_id).toBe('a');
      }
    });
    it('people who lose a drawn-first prize stay in for the prizes after it', () => {
      const { won } = draw(
        [
          { id: 'one', winners: 1, rank: 1, entrants: ['a', 'b'] },
          { id: 'two', winners: 1, rank: 2, entrants: ['a', 'b'] },
        ],
        'x',
      );
      expect(new Set(won.map((w) => w.user_id)).size).toBe(2);
    });
    it('prizes of the same rank go least contested first', () => {
      for (let i = 0; i < 30; i++) {
        const { won } = draw(
          [
            { id: 'popular', winners: 1, rank: 1, entrants: ['a', 'b', 'c', 'd'] },
            { id: 'rare', winners: 1, rank: 1, entrants: ['a'] },
          ],
          `t${i}`,
        );
        expect(won.find((w) => w.item_id === 'rare')?.user_id).toBe('a');
      }
    });
    it('by value: the most valuable first, and prices within 20% are a tie', () => {
      const r = rankByValue([
        { id: 'big', price: 100 },
        { id: 'near', price: 85 },
        { id: 'mid', price: 40 },
        { id: 'small', price: 5 },
      ]);
      expect([r.get('big'), r.get('near'), r.get('mid'), r.get('small')]).toEqual([1, 1, 2, 3]);
    });
    it('a number the host set wins over value, and prizes without one come after', () => {
      const r = ranksFor([
        { id: 'a', draw_order: null, price: 100 },
        { id: 'b', draw_order: 3, price: 1 },
        { id: 'c', draw_order: 1, price: 1 },
      ]);
      expect(r.get('c')! < r.get('b')!).toBe(true);
      expect(r.get('b')! < r.get('a')!).toBe(true);
    });
  });
  describe('leftovers', () => {
    const one = [{ id: 'x', winners: 2, entrants: ['a'] }];
    it('open spots go to the people who said they would take anything, before everyone else', () => {
      for (let i = 0; i < 30; i++) {
        const { won } = draw(one, `l${i}`, [], { anything: ['v'], everyone: ['a', 'v', 'p', 'q'] });
        expect(won.map((w) => [w.user_id, w.via])).toEqual([
          ['a', 'entered'],
          ['v', 'leftover'],
        ]);
      }
    });
    it('then from everyone else who has not won', () => {
      const { won } = draw(one, 's', [], { everyone: ['a', 'p'] });
      expect(won.map((w) => [w.user_id, w.via])).toEqual([
        ['a', 'entered'],
        ['p', 'leftover'],
      ]);
    });
    it('a prize nobody entered is still given out', () => {
      const { won } = draw([{ id: 'x', winners: 2, entrants: [] }], 's', [], { anything: ['v'], everyone: ['v', 'p', 'q'] });
      expect(won).toHaveLength(2);
      expect(won.every((w) => w.via === 'leftover')).toBe(true);
      expect(won[0].user_id).toBe('v');
    });
    it('nobody wins twice across entered and leftover prizes', () => {
      for (let i = 0; i < 30; i++) {
        const { won } = draw(
          [
            { id: 'p1', winners: 1, entrants: ['a', 'b'] },
            { id: 'p2', winners: 2, entrants: [] },
          ],
          `n${i}`,
          [],
          { anything: ['a', 'b', 'c'], everyone: ['a', 'b', 'c', 'd'] },
        );
        const people = won.map((w) => w.user_id);
        expect(new Set(people).size).toBe(people.length);
        expect(won).toHaveLength(3);
      }
    });
    it('when there are not enough people, some spots stay open', () => {
      expect(draw([{ id: 'x', winners: 3, entrants: [] }], 's', [], { everyone: ['p'] }).won).toHaveLength(1);
    });
  });
  it('the odds are a guide from how many entered', () => {
    expect(oddsOf(4, 2, true)).toEqual({ all: false, oneIn: 2 });
    expect(oddsOf(3, 1, false)).toEqual({ all: false, oneIn: 4 });
    expect(oddsOf(1, 2, false).all).toBe(true); // (you would make 2 entrants for 2 winners)
    expect(oddsOf(0, 1, false)).toEqual({ all: true, oneIn: 1 });
  });
});
