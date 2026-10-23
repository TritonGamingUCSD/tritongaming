import { describe, expect, it } from 'vitest';
import { canEditRequest, cleanRequestItems, prizeSizes, requestSummary, type DeviceItem, type PrizeItem } from '@/lib/logistics/requests';

const known = { bundles: ['PC Station'], types: ['Monitor', 'Gaming Laptop'], sizes: ['Free', 'Small Prizing', 'Medium Prizing', 'Large Prizing'] };

describe('request items', () => {
  it('accepts a bundle or a type, ignoring capitals, with games', () => {
    const r = cleanRequestItems('devices', [{ what: 'pc station', qty: 4, games: ['Valorant', ' '] }, { what: 'MONITOR', qty: 2 }], known);
    expect(r).toEqual({ items: [{ what: 'PC Station', qty: 4, games: ['Valorant'] }, { what: 'Monitor', qty: 2, games: [] }] });
  });
  it('refuses what does not exist or makes no sense', () => {
    expect(cleanRequestItems('devices', [{ what: 'Toaster', qty: 1 }], known)).toHaveProperty('error');
    expect(cleanRequestItems('devices', [{ what: 'Monitor', qty: 0 }], known)).toHaveProperty('error');
    expect(cleanRequestItems('devices', [], known)).toHaveProperty('error');
    expect(cleanRequestItems('prizes', [{ qty: 5, size: 'Huge' }], known)).toHaveProperty('error');
    expect(cleanRequestItems('prizes', [{ qty: 0, size: 'Free' }], known)).toHaveProperty('error');
  });
  it('lets a prize request have no lines (just the team) but not a device request', () => {
    expect(cleanRequestItems('prizes', [], known)).toEqual({ items: [] });
    expect(requestSummary('prizes', [])).toBe('prizes, no amount set');
  });
  it('lets a prize line leave the size blank (any size), counting toward the total only', () => {
    const r = cleanRequestItems('prizes', [{ qty: 4, size: '' }, { qty: 1, size: null }, { qty: 2, size: 'Free' }], known) as { items: PrizeItem[] };
    expect(r.items).toEqual([{ qty: 4, size: null }, { qty: 1, size: null }, { qty: 2, size: 'Free' }]);
    expect(prizeSizes(r.items)).toEqual({ Free: 2 });
    expect(requestSummary('prizes', r.items)).toBe('4 prizes of any size, 1 prizes of any size, 2 Free');
  });
  it('takes a prize size, ignoring capitals, and adds up the sizes', () => {
    const r = cleanRequestItems('prizes', [{ qty: 10, size: 'small prizing' }, { qty: 3, size: 'Large Prizing' }, { qty: 2, size: 'Small Prizing' }], known) as { items: PrizeItem[] };
    expect(r.items[0]).toEqual({ qty: 10, size: 'Small Prizing' });
    expect(prizeSizes(r.items)).toEqual({ 'Small Prizing': 12, 'Large Prizing': 3 });
  });
});

describe('request words and rights', () => {
  it('says a request in one line', () => {
    expect(requestSummary('devices', [{ what: 'PC Station', qty: 4, games: ['Valorant'] }] as DeviceItem[])).toBe('4 × PC Station (Valorant)');
    expect(requestSummary('prizes', [{ qty: 1, size: 'Large Prizing' }, { qty: 10, size: 'Free' }])).toBe('1 Large Prizing, 10 Free');
  });
  it('lets only the Event Logistics team change or remove a submitted request', () => {
    expect(canEditRequest(false)).toBe(false);
    expect(canEditRequest(true)).toBe(true);
  });
});

import { rowDiff, wantedRows } from '@/lib/logistics/requestRows';
describe('request rows', () => {
  const bundles = new Map([['pc station', [{ type: 'Gaming PC', qty: 1 }, { type: 'Monitor', qty: 2 }]]]);
  it('makes a set per unit of a bundle and plain rows for a type', () => {
    const w = wantedRows([{ what: 'PC Station', qty: 2, games: ['Valorant'] }, { what: 'Mouse', qty: 3, games: [] }], bundles);
    expect(w.length).toBe(9);
    expect(w.filter((x) => x.set === 1).length).toBe(3);
    expect(w.filter((x) => x.type === 'Gaming PC').every((x) => x.games[0] === 'Valorant')).toBe(true);
  });
  it('says how many rows to add or take away', () => {
    const w = wantedRows([{ what: 'PC Station', qty: 2, games: [] }], bundles);
    expect(Object.fromEntries(rowDiff(w, new Map([['gaming pc', 2], ['monitor', 4]])))).toEqual({});
    expect(Object.fromEntries(rowDiff(w, new Map([['gaming pc', 3], ['monitor', 1]])))).toEqual({ 'gaming pc': -1, monitor: 3 });
  });
});

import { planProblems } from '@/lib/logistics/plans';
describe('allocation matches the requests', () => {
  const row = (id: string, requested: boolean | undefined) => ({ id, kind: 'club' as const, type: 'Monitor', tag: id, station_id: 's', games_needed: [], games: [], counted: false, located: true, requested });
  it('flags a device that no request asked for, and nothing else', () => {
    const p = planProblems([row('A', false), row('B', true), row('C', undefined)], [], [], new Set(), [], () => null);
    expect(p.filter((x) => x.why === 'unrequested').map((x) => x.row_id)).toEqual(['A']);
  });
});

import { ANY_SIZE, planPrizeUse, suggestPrizes } from '@/lib/logistics/prizes';
describe('prize suggestions', () => {
  const stock = [{ id: 'a', size: 'Small Prizing', left: 10, sponsor: false }, { id: 'b', size: 'Small Prizing', left: 2, sponsor: false }, { id: 's', size: 'Medium Prizing', left: 1, sponsor: true }, { id: 'm', size: 'Medium Prizing', left: 1, sponsor: false }, { id: 'z', size: 'Large Prizing', left: 0, sponsor: false }];
  it('fills each size from prizes of that size, never more than is left', () => {
    const { picks, short } = suggestPrizes(stock, { 'Small Prizing': 3, 'Medium Prizing': 2 });
    expect([...picks.entries()].filter(([id]) => id === 'a' || id === 'b').reduce((n, [, x]) => n + x, 0)).toBe(3);
    expect(picks.get('s')).toBe(1);
    expect(picks.get('m')).toBe(1);
    expect(short).toEqual({});
  });
  it('spreads over what has the most left, sponsor first on a tie', () => {
    const { picks } = suggestPrizes(stock, { 'Small Prizing': 2 });
    expect(picks.get('a')).toBe(2);
    expect(suggestPrizes(stock, { 'Medium Prizing': 1 }).picks.get('s')).toBe(1);
  });
  it('fills a count of any size from what the sizes left, most left first', () => {
    const { picks, short } = suggestPrizes(stock, { 'Small Prizing': 11, [ANY_SIZE]: 3 });
    expect(picks.get('a')).toBe(10);
    expect(picks.get('b')).toBe(2);
    expect(picks.get('s')).toBe(1);
    expect(picks.get('m')).toBe(1);
    expect([...picks.values()].reduce((n, v) => n + v, 0)).toBe(14);
    expect(short).toEqual({});
  });
  it('says how many of a size could not be found', () => {
    const { picks, short } = suggestPrizes(stock, { 'Large Prizing': 2, 'Medium Prizing': 3 });
    expect(picks.has('z')).toBe(false);
    expect(short).toEqual({ 'Large Prizing': 2, 'Medium Prizing': 1 });
  });
});

describe('closing an event and the stock', () => {
  it('holds the prizes while the event is open', () => {
    expect(planPrizeUse({ quantity: 10, given: 3, moved: 0, closed: false, manual: true })).toEqual({ allocated: 7, given: 3 });
  });
  it('an older closed event counts only what was given out', () => {
    expect(planPrizeUse({ quantity: 10, given: 3, moved: 0, closed: true, manual: false })).toEqual({ allocated: 0, given: 3 });
  });
  it('a newer closed event uses up everything not moved back by hand', () => {
    expect(planPrizeUse({ quantity: 10, given: 3, moved: 0, closed: true, manual: true })).toEqual({ allocated: 0, given: 10 });
    expect(planPrizeUse({ quantity: 10, given: 3, moved: 4, closed: true, manual: true })).toEqual({ allocated: 0, given: 6 });
  });
  it('never moves back more than was not given out', () => {
    expect(planPrizeUse({ quantity: 10, given: 8, moved: 5, closed: true, manual: true })).toEqual({ allocated: 0, given: 8 });
  });
});
