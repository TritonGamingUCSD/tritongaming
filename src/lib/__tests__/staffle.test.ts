import { describe, expect, it } from 'vitest';
import { canEnter, cleanRules, NO_RULES, rulesEmpty, rulesText } from '@/lib/staffle/rules';
import { draw, oddsOf } from '@/lib/staffle/draw';

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
  it('describes the rules', () => {
    expect(rulesText(NO_RULES)).toBe('Open to everyone on the team');
    expect(rulesText({ ...NO_RULES, roles: ['officer', 'lead'], people: [A] }, new Map([[A, 'Sam']]))).toBe('Open to officers and leads + Sam');
    expect(rulesText({ ...NO_RULES, skip: ['strike'], block: [B] }, new Map([[B, 'Jo']]))).toBe('Open to everyone on the team, not people with strikes or Jo');
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
  it('nobody wins twice, and an item gets as many winners as it asks for (or fewer when fewer entered)', () => {
    for (let i = 0; i < 40; i++) {
      const { won } = draw(items, `x${i}`);
      const people = won.map((w) => w.user_id);
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
