import { describe, expect, it } from 'vitest';
import { countdownTiles, daysBetween, daysLabel, holidaysOf, nextHolidays, nthWeekday } from '../countdowns';

describe('countdowns', () => {
  it('counts whole days between two days', () => {
    expect(daysBetween('2026-11-06', '2026-11-26')).toBe(20);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-06', '2026-11-06')).toBe(0);
  });
  it('finds the nth weekday of a month', () => {
    expect(nthWeekday(2026, 11, 4, 4)).toBe('2026-11-26'); // Thanksgiving 2026
    expect(nthWeekday(2027, 11, 4, 4)).toBe('2027-11-25');
    expect(nthWeekday(2026, 5, 1, -1)).toBe('2026-05-25'); // Memorial Day
    expect(nthWeekday(2026, 1, 1, 3)).toBe('2026-01-19'); // MLK Day
    expect(nthWeekday(2026, 9, 1, 1)).toBe('2026-09-07'); // Labor Day
  });
  it('lists the year’s holidays in order', () => {
    const h = holidaysOf(2026);
    expect(h.map((x) => x.day)).toEqual([...h.map((x) => x.day)].sort());
    expect(h.find((x) => x.name === 'Halloween')?.day).toBe('2026-10-31');
    expect(h.find((x) => x.name === 'Lunar New Year')?.day).toBe('2026-02-17');
  });
  it('gives the next holidays, rolling into next year', () => {
    const n = nextHolidays('2026-11-06', 3);
    expect(n.map((x) => x.name)).toEqual(['Veterans Day', 'Thanksgiving', 'Christmas']);
    expect(n[1].days).toBe(20);
    expect(nextHolidays('2026-12-30', 2).map((x) => x.name)).toEqual(['New Year’s Eve', 'New Year’s Day']);
    expect(nextHolidays('2026-12-25', 1)[0].days).toBe(0);
  });
  it('words the days', () => {
    expect(daysLabel(0)).toBe('Today');
    expect(daysLabel(1)).toBe('Tomorrow');
    expect(daysLabel(12)).toBe('12 days');
  });
  it('builds the tiles from what is known', () => {
    const t = countdownTiles({
      today: '2026-11-06',
      term: { name: 'Fall 2026', endsOn: '2026-12-11', state: 'in', nextName: 'Winter 2027', nextStartsOn: '2027-01-04' },
      event: { title: 'Smash Night', day: '2026-11-08' },
    });
    expect(t.map((x) => x.id)).toEqual(['event', 'holiday', 'holiday2', 'quarter']);
    expect(t.map((x) => x.days)).toEqual([2, 5, 20, 35]);
  });
  it('shows the next quarter during a break and leaves out what it does not know', () => {
    const t = countdownTiles({ today: '2026-12-20', term: { name: 'Fall 2026', endsOn: '2026-12-11', state: 'break', nextName: 'Winter 2027', nextStartsOn: '2027-01-04' } });
    expect(t.map((x) => x.id)).toEqual(['holiday', 'holiday2', 'next']);
    expect(countdownTiles({ today: '2026-11-06' }).map((x) => x.id)).toEqual(['holiday', 'holiday2']);
  });
});
