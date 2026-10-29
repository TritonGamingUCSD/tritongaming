import { describe, expect, it } from 'vitest';
import { eventHolds, groupBy, needText, prizingFixes, statusOf, stationNeed, valueOf } from '@/lib/logistics/prizing';
import { ANY_SIZE, lineNumbers, prizeLeft, stepCeiling } from '@/lib/logistics/prizes';

describe('stock', () => {
  it('left is what is on hand minus what open events hold', () => {
    expect(prizeLeft({ quantity: 10 }, { allocated: 4 })).toBe(6);
    expect(prizeLeft({ quantity: 3 }, { allocated: 5 })).toBe(-2);
  });
});

describe('one prize line: planned, given out, back, held', () => {
  it('holds what is neither given out nor back in storage', () => {
    expect(lineNumbers(10, 0, 0)).toEqual({ planned: 10, given: 0, back: 0, held: 10 });
    expect(lineNumbers(10, 4, 0)).toEqual({ planned: 10, given: 4, back: 0, held: 6 });
    expect(lineNumbers(10, 4, 6)).toEqual({ planned: 10, given: 4, back: 6, held: 0 });
  });
  it('marking prizes back in storage frees them at once', () => {
    expect(lineNumbers(10, 4, 3).held).toBe(3);
    expect(prizeLeft({ quantity: 20 }, { allocated: lineNumbers(10, 4, 3).held })).toBe(17);
  });
  it('never goes negative or counts more than was promised', () => {
    expect(lineNumbers(5, 9, 9)).toEqual({ planned: 5, given: 5, back: 0, held: 0 });
    expect(lineNumbers(5, 2, 9)).toEqual({ planned: 5, given: 2, back: 3, held: 0 });
    expect(lineNumbers(5, -3, -1)).toEqual({ planned: 5, given: 0, back: 0, held: 5 });
  });
  it('back in storage can only reach what was not given out', () => {
    expect(stepCeiling({ leftover: true }, { quantity: 10 }, 4)).toBe(6);
    expect(stepCeiling({ leftover: false }, { quantity: 10 }, 4)).toBe(10);
  });
});

describe('what an event holds of a prize', () => {
  it('adds the lines of a prize and takes off what was given out or came back', () => {
    const lines = [
      { id: 'l1', station_id: 's1', prize_id: 'p', quantity: 5 },
      { id: 'l2', station_id: 's2', prize_id: 'p', quantity: 3 },
      { id: 'l3', station_id: 's1', prize_id: 'q', quantity: 2 },
    ];
    const h = eventHolds(lines, (l) => (l.id === 'l1' ? 2 : l.id === 'l2' ? 3 : 0)); // l1: 2 released, l2: all 3 released (given or back)
    expect(h.get('p')).toMatchObject({ total: 8, remaining: 3 });
    expect(h.get('q')).toMatchObject({ total: 2, remaining: 2 });
  });
});

describe('status', () => {
  const p = (o: Partial<{ left: number; quantity: number; in_hand: boolean }>) => ({ left: 5, quantity: 5, in_hand: true, ...o });
  it('puts the red things first', () => {
    expect(statusOf(p({ left: -1 }), 3)).toBe('over');
    expect(statusOf(p({ in_hand: false }), 2)).toBe('not-here');
    expect(statusOf(p({}), 2)).toBe('assigned');
    expect(statusOf(p({}), 0)).toBe('free');
    expect(statusOf(p({ quantity: 0, left: 0 }), 0)).toBe('out');
  });
});

describe('grouping', () => {
  it('groups by a value, an order for known keys, and the rest last', () => {
    const rows = [
      { n: 'a', z: 'Small' },
      { n: 'b', z: null },
      { n: 'c', z: 'Large' },
      { n: 'd', z: 'Small' },
    ];
    const g = groupBy(rows, (r) => r.z, 'No size', ['Small', 'Medium', 'Large']);
    expect(g.map((x) => [x.label, x.rows.length])).toEqual([
      ['Small', 2],
      ['Large', 1],
      ['No size', 1],
    ]);
  });
});

describe('what a station asked for', () => {
  const lines = [
    { quantity: 2, size: 'Small Prizing' },
    { quantity: 1, size: null },
  ];
  it('names the sizes still missing and a count of any size', () => {
    const r = stationNeed({ prize_target_qty: 6, prize_target_sizes: { 'Small Prizing': 3, 'Medium Prizing': 1 } }, lines);
    expect(r.need).toEqual({ 'Small Prizing': 1, 'Medium Prizing': 1, [ANY_SIZE]: 1 });
    expect(needText(r.need, ['Free', 'Small Prizing', 'Medium Prizing'])).toBe('1 Small Prizing, 1 Medium Prizing, 1 of any size');
  });
  it('needs nothing when it has what it asked for', () => {
    expect(stationNeed({ prize_target_qty: 3, prize_target_sizes: { 'Small Prizing': 2 } }, lines).need).toEqual({});
  });
  it('adds up the value', () => {
    expect(
      valueOf([
        { quantity: 2, price: 24.5 },
        { quantity: 3, price: null },
      ]),
    ).toBe(49);
  });
});

describe('fix these', () => {
  it('lists over-promised prizes, short stations, empty stations and prizes not here yet', () => {
    const prize = (o: object) => ({
      id: 'p',
      name: 'Mouse',
      sponsor_id: null,
      size: null,
      type: null,
      in_hand: true,
      price: null,
      quantity: 1,
      allocated: 1,
      left: 0,
      assignedHere: 1,
      ...o,
    });
    const fixes = prizingFixes({
      prizes: [prize({ left: -2 }), prize({ id: 'q', name: 'Soda', in_hand: false })],
      stations: [
        { id: 's1', name: 'Raffle', lines: 0, short: {} },
        { id: 's2', name: 'Valorant', lines: 2, short: { 'Small Prizing': 2 } },
      ],
      sizeOrder: ['Small Prizing'],
    });
    expect(fixes.map((f) => f.text)).toEqual([
      'Mouse: 2 more promised than there are',
      'Raffle has no prizes yet',
      'Valorant still needs 2 Small Prizing',
      '1 prize in this event is not here yet (Soda)',
    ]);
    expect(fixes[0].sev).toBe('bad');
  });
});

describe('impliedCount', () => {
  const steps = [
    { id: 'sorted', leftover: false },
    { id: 'picked', leftover: false },
    { id: 'given', leftover: false },
    { id: 'back', leftover: true },
  ];
  const counts = (m: Record<string, number>) => (id: string) => m[id] ?? 0;
  it('a later count implies the earlier steps', async () => {
    const { impliedCount } = await import('@/lib/logistics/prizing');
    expect(impliedCount(steps, counts({ given: 3 }), 'sorted')).toBe(3);
    expect(impliedCount(steps, counts({ given: 3, picked: 5 }), 'sorted')).toBe(5);
    expect(impliedCount(steps, counts({ sorted: 4, given: 3 }), 'sorted')).toBe(4);
  });
  it('back to storage neither implies nor is implied', async () => {
    const { impliedCount } = await import('@/lib/logistics/prizing');
    expect(impliedCount(steps, counts({ back: 2 }), 'sorted')).toBe(0);
    expect(impliedCount(steps, counts({ given: 3 }), 'back')).toBe(0);
  });
});

describe('Staffle holds are counted apart from events', () => {
  it('left is on hand minus what open events hold minus what a Staffle holds', () => {
    expect(prizeLeft({ quantity: 4 }, { allocated: 0, staffle: 1 })).toBe(3);
    expect(prizeLeft({ quantity: 4 }, { allocated: 2, staffle: 1 })).toBe(1);
    expect(prizeLeft({ quantity: 4 }, { allocated: 2 })).toBe(2);
  });
});
