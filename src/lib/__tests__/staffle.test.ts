import { describe, expect, it } from 'vitest';
import { canEnter, cleanRules, groupsOf, NO_RULES, rulesText } from '@/lib/staffle/rules';
import { draw } from '@/lib/staffle/draw';

const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b';
const officer = { id: 'o', roles: ['officer'], marks: 0 }, recruit = { id: 'r', roles: ['recruit'], marks: 0 };

describe('groups', () => {
  it('works out who is in which group', () => {
    expect(groupsOf(officer)).toEqual(['officer', 'active']);
    expect(groupsOf(recruit)).toEqual(['recruit', 'active']);
    expect(groupsOf({ roles: ['officer', 'inactive'], marks: 0 })).toEqual(['officer', 'inactive']);
    expect(groupsOf({ roles: ['officer'], marks: 1 })).toContain('warning');
    expect(groupsOf({ roles: ['officer'], marks: 3 })).toContain('strike');
    expect(groupsOf({ roles: ['exec'], marks: 0 })).toContain('officer');
  });
});

describe('who may enter', () => {
  it('everyone with no rules', () => { expect(canEnter(NO_RULES, officer).ok).toBe(true); });
  it('groups in and out', () => {
    expect(canEnter({ ...NO_RULES, in: ['officer'] }, recruit).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, in: ['officer'] }, officer).ok).toBe(true);
    expect(canEnter({ ...NO_RULES, out: ['inactive'] }, { id: 'x', roles: ['officer', 'inactive'], marks: 0 }).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, out: ['strike'] }, { id: 'x', roles: ['officer'], marks: 2 }).ok).toBe(false);
  });
  it('names added are in, names blocked are out (blocked wins)', () => {
    expect(canEnter({ ...NO_RULES, in: ['officer'], add: ['r'] }, recruit).ok).toBe(true);
    expect(canEnter({ ...NO_RULES, block: ['o'] }, officer).ok).toBe(false);
    expect(canEnter({ ...NO_RULES, add: ['o'], block: ['o'] }, officer).ok).toBe(false);
  });
  it('says why in words', () => {
    const r = canEnter({ ...NO_RULES, in: ['officer'] }, recruit);
    expect(r.ok === false && r.why).toMatch(/only open to officers/);
  });
  it('cleans what a client sent', () => {
    expect(cleanRules({ in: ['officer', 'nonsense'], out: 'x', add: [A, 'bad', A], block: [B] })).toEqual({ in: ['officer'], out: [], add: [A], block: [B] });
  });
  it('describes the rules', () => {
    expect(rulesText(NO_RULES)).toBe('Open to all staff');
    expect(rulesText({ ...NO_RULES, in: ['officer'], out: ['strike'] })).toBe('Open to officers, not people with strikes');
  });
});

describe('the draw', () => {
  const items = [{ id: 'i1', winners: 1, entrants: ['a', 'b', 'c'] }, { id: 'i2', winners: 2, entrants: ['a', 'b', 'c', 'd'] }, { id: 'i3', winners: 1, entrants: ['a'] }];
  it('is the same for the same seed and different for another', () => {
    expect(draw(items, 'seed-1')).toEqual(draw(items, 'seed-1'));
    const seeds = new Set(Array.from({ length: 30 }, (_, i) => draw(items, `s${i}`).order.join()));
    expect(seeds.size).toBeGreaterThan(1);
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
  it('an item nobody entered has no winners', () => {
    expect(draw([{ id: 'x', winners: 3, entrants: [] }], 's').won).toEqual([]);
  });
  it('people who already won are left out', () => {
    expect(draw([{ id: 'x', winners: 1, entrants: ['a', 'b'] }], 's', ['a']).won.map((w) => w.user_id)).toEqual(['b']);
  });
});
