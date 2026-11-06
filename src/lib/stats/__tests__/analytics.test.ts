import { describe, expect, it, test } from 'vitest';
import { dailyCounts, newVersusReturning, retentionCohorts, sliceCounts, tierBuckets, weekdayHourCounts } from '../analytics';

describe('analytics math', () => {
  test('weekday and hour are read in Pacific time', () => {
    // 2026-11-02 is a Monday. 18:30 UTC is 10:30 in Pacific time.
    const data = weekdayHourCounts(['2026-11-02T18:30:00Z', '2026-11-02T18:45:00Z', '2026-11-03T03:00:00Z'], [9, 10, 11, 19]);
    expect(data).toContainEqual([1, 0, 2]); // hour 10 is index 1, Monday, two check-ins
    expect(data).toContainEqual([3, 0, 1]); // 7pm Monday Pacific (03:00 UTC Tuesday)
  });

  test('hours outside the list are left out', () => {
    expect(weekdayHourCounts(['2026-11-02T18:30:00Z'], [8, 9])).toEqual([]);
  });

  test('daily counts use the Pacific day and come out oldest first', () => {
    expect(dailyCounts(['2026-11-03T08:30:00Z', '2026-11-02T20:00:00Z', '2026-11-02T08:00:00Z'])).toEqual([
      ['2026-11-02', 2],
      ['2026-11-03', 1],
    ]);
  });

  test('retention cohorts: first month is the cohort, later cells are the share who came back', () => {
    const now = new Date('2026-12-15T12:00:00Z');
    const rows = [
      { user: 'a', at: '2026-10-05T19:00:00Z' },
      { user: 'b', at: '2026-10-06T19:00:00Z' },
      { user: 'a', at: '2026-11-05T19:00:00Z' },
      { user: 'c', at: '2026-11-07T19:00:00Z' },
    ];
    const r = retentionCohorts(rows, now, 3, 2);
    expect(r.sizes).toEqual([2, 1]); // Oct: a, b; Nov: c
    expect(r.data).toContainEqual([0, 0, 100]);
    expect(r.data).toContainEqual([1, 0, 50]); // only a came back in November
    expect(r.data).toContainEqual([2, 0, 0]);
    expect(r.data).toContainEqual([0, 1, 100]);
    expect(r.data).toContainEqual([1, 1, 0]);
  });

  test('a month that has not happened yet gets no cell', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    const r = retentionCohorts([{ user: 'a', at: '2026-11-05T19:00:00Z' }], now, 3, 3);
    expect(r.data).toEqual([[0, 0, 100]]);
  });

  test('tiers count each person once, in the highest tier they reached', () => {
    const tiers = [
      { name: 'Bronze', min: 0 },
      { name: 'Silver', min: 100 },
      { name: 'Gold', min: 500 },
    ];
    expect(tierBuckets([0, 50, 100, 499, 500, 900], tiers)).toEqual([
      { name: 'Bronze', value: 2 },
      { name: 'Silver', value: 2 },
      { name: 'Gold', value: 2 },
    ]);
  });

  test('new versus returning counts each person once', () => {
    expect(newVersusReturning(['a', 'b', 'b', 'c'], new Set(['a', 'x']))).toEqual({ newcomers: 2, returning: 1 });
  });

  test('slices count arrivals over time and keep a running total', () => {
    const t0 = Date.parse('2026-11-02T18:00:00Z');
    const r = sliceCounts(['2026-11-02T18:05:00Z', '2026-11-02T18:10:00Z', '2026-11-02T18:35:00Z'], t0, t0 + 3600e3, 2);
    expect(r.counts).toEqual([2, 1]);
    expect(r.total).toEqual([2, 3]);
  });
});

import { rangeStart, runningTotal, seriesByGran } from '../analytics';
import { monthLabels } from '@/lib/events/monthBuckets';

describe('month labels', () => {
  it('are just the month name inside one year', () => {
    const l = monthLabels(['2026-05', '2026-06', '2026-07']);
    expect([...l.values()]).toEqual(['May', 'Jun', 'Jul']);
  });
  it('carry the year on the first month and each January once the series crosses a year', () => {
    const l = monthLabels(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect([...l.values()]).toEqual(['Nov ’26', 'Dec', 'Jan ’27', 'Feb']);
  });
});

describe('time series by day, week and month', () => {
  const daily: [string, number][] = [
    ['2026-11-02', 3],
    ['2026-11-04', 2],
    ['2026-11-09', 5],
  ];
  it('fills every day of the range, quiet days as 0', () => {
    const s = seriesByGran(daily, 'day', '2026-11-02', '2026-11-05');
    expect(s.values).toEqual([3, 0, 2, 0]);
    expect(s.labels[0]).toBe('Nov 2');
  });
  it('groups by week from Monday', () => {
    const s = seriesByGran(daily, 'week', '2026-11-02', '2026-11-15');
    expect(s.keys).toEqual(['2026-11-02', '2026-11-09']);
    expect(s.values).toEqual([5, 5]);
  });
  it('groups by month and names it plainly', () => {
    const s = seriesByGran(
      [
        ['2026-10-31', 1],
        ['2026-11-01', 2],
      ],
      'month',
      '2026-10-30',
      '2026-11-02',
    );
    expect(s.labels).toEqual(['Oct', 'Nov']);
    expect(s.values).toEqual([1, 2]);
  });
  it('makes a running total that starts from what was there before', () => {
    expect(runningTotal([1, 0, 2], 10)).toEqual([11, 11, 13]);
  });
  it('counts times per Pacific day and finds the start of a range', () => {
    expect(dailyCounts(['2026-11-03T07:30:00Z', '2026-11-03T20:00:00Z'])).toEqual([
      ['2026-11-02', 1],
      ['2026-11-03', 1],
    ]);
    expect(rangeStart('30d', '2026-11-30', '2026-01-01')).toBe('2026-11-01');
    expect(rangeStart('all', '2026-11-30', '2026-03-05')).toBe('2026-03-05');
  });
});
