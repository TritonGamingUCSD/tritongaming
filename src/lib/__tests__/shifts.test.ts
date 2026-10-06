import { describe, expect, it } from 'vitest';
import { cellKey, mayClaim, neededFor, slotCount, slotRange } from '@/lib/shifts';

const plan = { starts_at: '2026-10-24T18:00:00.000Z', ends_at: '2026-10-24T21:30:00.000Z', slot_minutes: 60 };

describe('shift slots', () => {
  it('rounds the last, shorter slot up', () => { expect(slotCount(plan)).toBe(4); });
  it('cuts the last slot at the end of the day', () => {
    const last = slotRange(plan, 3);
    expect(last.end.toISOString()).toBe('2026-10-24T21:30:00.000Z');
  });
  it('never makes more than the maximum', () => { expect(slotCount({ ...plan, ends_at: '2026-10-30T00:00:00.000Z', slot_minutes: 15 })).toBe(48); });
});

describe('people needed', () => {
  const grid = { stations: [{ id: 's1', name: 'Door', default_needed: 2, sort_order: 0, description: null }], overrides: { [cellKey('s1', 1)]: 0 } };
  it('uses the station default', () => { expect(neededFor(grid, 's1', 0)).toBe(2); });
  it('uses an override, even zero', () => { expect(neededFor(grid, 's1', 1)).toBe(0); });
});

describe('who may claim a cell', () => {
  it('lets officers and leads in', () => { expect(mayClaim([{ role: 'officer' }], true)).toBe(true); expect(mayClaim([{ role: 'lead' }], true)).toBe(true); });
  it('keeps recruits out unless the shift is open to them', () => { expect(mayClaim([{ role: 'recruit' }], true)).toBe(false); expect(mayClaim([{ role: 'recruit' }], false)).toBe(true); });
  it('never lets students or alumni in', () => { expect(mayClaim([{ role: 'ucsd' }, { role: 'alumni' }], false)).toBe(false); });
});

describe('inactive members', () => {
  it('can still claim shifts: inactive is a marker next to the real roles', () => {
    expect(mayClaim([{ role: 'officer' }, { role: 'inactive' }], true)).toBe(true);
    expect(mayClaim([{ role: 'lead' }, { role: 'inactive' }], true)).toBe(true);
  });
});
