import { describe, expect, it } from 'vitest';
import { canEditRequest, cleanRequestItems, prizeTotal, requestSummary, type DeviceItem, type PrizeItem } from '@/lib/logistics/requests';

const known = { bundles: ['PC Station'], types: ['Monitor', 'Gaming Laptop'] };

describe('request items', () => {
  it('accepts a bundle or a type, ignoring capitals, with games', () => {
    const r = cleanRequestItems('devices', [{ what: 'pc station', qty: 4, games: ['Valorant', ' '] }, { what: 'MONITOR', qty: 2 }], known);
    expect(r).toEqual({ items: [{ what: 'PC Station', qty: 4, games: ['Valorant'] }, { what: 'Monitor', qty: 2, games: [] }] });
  });
  it('refuses what does not exist or makes no sense', () => {
    expect(cleanRequestItems('devices', [{ what: 'Toaster', qty: 1 }], known)).toHaveProperty('error');
    expect(cleanRequestItems('devices', [{ what: 'Monitor', qty: 0 }], known)).toHaveProperty('error');
    expect(cleanRequestItems('devices', [], known)).toHaveProperty('error');
    expect(cleanRequestItems('prizes', [{ qty: 5, value: -1 }], known)).toHaveProperty('error');
    expect(cleanRequestItems('prizes', [{ qty: 0, value: 5 }], known)).toHaveProperty('error');
  });
  it('rounds a dollar value to cents and adds a total', () => {
    const r = cleanRequestItems('prizes', [{ qty: 10, value: 24.999 }, { qty: 3, value: 100 }], known) as { items: PrizeItem[] };
    expect(r.items[0].value).toBe(25);
    expect(prizeTotal(r.items)).toBe(550);
  });
});

describe('request words and rights', () => {
  it('says a request in one line', () => {
    expect(requestSummary('devices', [{ what: 'PC Station', qty: 4, games: ['Valorant'] }] as DeviceItem[])).toBe('4 × PC Station (Valorant)');
    expect(requestSummary('prizes', [{ qty: 1, value: 25 }, { qty: 10, value: 4.5 }] as PrizeItem[])).toBe('1 prize around $25, 10 prizes around $4.50');
  });
  it('lets a requester edit only their own until it is planned', () => {
    expect(canEditRequest({ requester_id: 'a', status: 'submitted' }, 'a', false)).toBe(true);
    expect(canEditRequest({ requester_id: 'a', status: 'planned' }, 'a', false)).toBe(false);
    expect(canEditRequest({ requester_id: 'a', status: 'submitted' }, 'b', false)).toBe(false);
    expect(canEditRequest({ requester_id: 'a', status: 'done' }, 'b', true)).toBe(true);
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

import { suggestPrizes } from '@/lib/logistics/prizes';
describe('prize suggestions', () => {
  const stock = [{ id: 'a', price: 5, left: 10, sponsor: false }, { id: 'b', price: 20, left: 2, sponsor: false }, { id: 's', price: 20, left: 1, sponsor: true }, { id: 'z', price: 50, left: 0, sponsor: false }];
  it('picks the closest value, sponsor first when close, never more than is left', () => {
    const r = suggestPrizes(stock, 3, 60);
    expect(r.get('s')).toBe(1);
    expect(r.get('b')).toBe(2);
    expect(r.has('z')).toBe(false);
  });
  it('falls back to cheaper prizes and stops when stock runs out', () => {
    const r = suggestPrizes([{ id: 'a', price: 5, left: 2, sponsor: false }], 5, 100);
    expect([...r.values()].reduce((n, x) => n + x, 0)).toBe(2);
  });
});
