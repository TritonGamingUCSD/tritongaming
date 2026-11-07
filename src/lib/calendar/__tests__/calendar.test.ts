import { describe, expect, it } from 'vitest';
import { daysIn, groupByDay, itemSpan, startOfWeek, stepDate, viewRange } from '../grid';
import { buildIcs, fold, googleLink, icsFileName, outlookLink } from '../ics';
import type { CalItem } from '../types';

const ev = (o: Partial<CalItem> = {}): CalItem => ({
  id: 'event:1',
  kind: 'event',
  title: 'Smash Night',
  start: '2026-11-08T00:00:00.000Z',
  end: '2026-11-08T03:00:00.000Z',
  allDay: false,
  ...o,
});

describe('calendar grid', () => {
  it('a month view is whole weeks starting on Sunday', () => {
    const r = viewRange('month', '2026-11-15');
    expect(r.from).toBe('2026-11-01'); // a Sunday
    expect(r.to).toBe('2026-12-05'); // Saturday after the 30th
    expect(daysIn(r.from, r.to)).toHaveLength(35);
    const feb = viewRange('month', '2026-02-10');
    expect(feb.from).toBe('2026-02-01');
    expect(feb.to).toBe('2026-02-28');
  });
  it('a week view is seven days and an agenda is the month', () => {
    expect(viewRange('week', '2026-11-11')).toEqual({ from: '2026-11-08', to: '2026-11-14' });
    expect(viewRange('agenda', '2026-11-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(startOfWeek('2026-11-08')).toBe('2026-11-08');
  });
  it('steps by a week or a month', () => {
    expect(stepDate('week', '2026-11-11', 1)).toBe('2026-11-18');
    expect(stepDate('month', '2026-11-30', 1)).toBe('2026-12-01');
    expect(stepDate('month', '2026-01-15', -1)).toBe('2025-12-01');
  });
  it('puts an item on the Pacific day it happens (a late evening is the same day)', () => {
    // 2026-11-08 04:00Z is Nov 7, 8pm Pacific
    expect(itemSpan(ev({ start: '2026-11-08T04:00:00.000Z', end: '2026-11-08T06:00:00.000Z' }))).toEqual({ first: '2026-11-07', last: '2026-11-07' });
  });
  it('spreads a multi-day item over its days and sorts all-day first', () => {
    const trip: CalItem = { id: 'logistics:1', kind: 'logistics', title: 'Setup', start: '2026-11-09', end: '2026-11-11', allDay: true };
    const map = groupByDay([ev(), trip], '2026-11-01', '2026-11-30');
    expect([...map.keys()].sort()).toEqual(['2026-11-07', '2026-11-09', '2026-11-10', '2026-11-11']);
    expect(groupByDay([ev({ start: '2026-11-10T20:00:00.000Z', end: '2026-11-10T21:00:00.000Z' }), trip], '2026-11-10', '2026-11-10').get('2026-11-10')?.[0].id).toBe(
      'logistics:1',
    );
  });
  it('clips to the days in view', () => {
    const long: CalItem = { id: 'term:1', kind: 'term', title: 'Fall', start: '2026-09-24', end: '2026-12-11', allDay: true };
    expect(groupByDay([long], '2026-11-29', '2026-12-05').size).toBe(7);
  });
});

describe('calendar files', () => {
  it('folds long lines at 75 bytes and keeps words whole in a unicode text', () => {
    const f = fold('SUMMARY:' + 'é'.repeat(80));
    expect(f.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 76)).toBe(true);
    expect(f.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'é'.repeat(80));
  });
  it('builds a calendar with timed and all-day items and escapes text', () => {
    const ics = buildIcs(
      [
        ev({ title: 'A, B; C', location: 'Hall\nTwo', href: '/portal/events/x' }),
        { id: 'holiday:2026-12-25', kind: 'holiday', title: 'Christmas', start: '2026-12-25', allDay: true },
      ],
      {
        name: 'Triton Gaming',
        origin: 'https://example.org',
        now: new Date('2026-11-06T12:00:00Z'),
      },
    );
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261108T000000Z');
    expect(ics).toContain('SUMMARY:A\\, B\; C');
    expect(ics).toContain('LOCATION:Hall\\nTwo');
    expect(ics).toContain('URL:https://example.org/portal/events/x');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261225');
    expect(ics).toContain('DTEND;VALUE=DATE:20261226');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
  it('gives an item with no end an hour, and an all-day range its last day included', () => {
    const ics = buildIcs([ev({ end: null }), { id: 'term:1', kind: 'term', title: 'Fall', start: '2026-09-24', end: '2026-12-11', allDay: true }], {
      name: 'x',
      now: new Date('2026-11-06T12:00:00Z'),
    });
    expect(ics).toContain('DTEND:20261108T010000Z');
    expect(ics).toContain('DTEND;VALUE=DATE:20261212');
  });
  it('makes add-to-calendar links', () => {
    const g = googleLink(ev({ location: 'Hall' }), 'https://x.org');
    expect(g).toContain('calendar.google.com');
    expect(g).toContain('dates=20261108T000000Z%2F20261108T030000Z');
    expect(outlookLink(ev())).toContain('outlook.live.com');
    expect(icsFileName(ev({ title: 'Smash Night!' }))).toBe('smash-night.ics');
  });
});
