import { describe, it, expect } from 'vitest';
import { selfCheckinClosedReason } from '@/lib/events/selfCheckin';
import { dayHoursOverError } from '@/lib/events/checkinWindow';
import { cleanDayHours, dayHoursComplete, closingHours, formatDayHours } from '@/lib/events/dayHours';

// Pacific times written as UTC: PDT is UTC-7 until 1 Nov 2026 2:00 AM, then PST is UTC-8.
const at = (iso: string) => new Date(iso);
const oneDay = { start_date: '2026-10-16T00:00:00Z', end_date: '2026-10-16T04:00:00Z' }; // Oct 15 5:00 PM to 9:00 PM Pacific

describe('self check-in settings', () => {
  it('off is always closed', () => {
    expect(selfCheckinClosedReason('off', oneDay, at('2026-10-16T01:00:00Z'))?.code).toBe('closed');
  });
  it('until_end opens straight away, even before the event starts', () => {
    // The ended check reads the real clock, so use an event that is still ahead of it.
    const ahead = { start_date: new Date(Date.now() + 48 * 3600e3).toISOString(), end_date: new Date(Date.now() + 52 * 3600e3).toISOString() };
    expect(selfCheckinClosedReason('until_end', ahead)).toBeNull();
  });
  it('until_end stays open up to the end time and closes right after', () => {
    // isCheckinWindowOpen reads the real clock, so check with dates around "now".
    const now = Date.now();
    const open = { start_date: new Date(now - 3600e3).toISOString(), end_date: new Date(now + 60e3).toISOString() };
    const ended = { start_date: new Date(now - 7200e3).toISOString(), end_date: new Date(now - 60e3).toISOString() };
    expect(selfCheckinClosedReason('until_end', open)).toBeNull();
    expect(selfCheckinClosedReason('until_end', ended)?.code).toBe('ended');
  });
  it('forever never closes because of the end time', () => {
    const ended = { start_date: '2020-01-01T00:00:00Z', end_date: '2020-01-01T03:00:00Z' };
    expect(selfCheckinClosedReason('forever', ended)).toBeNull();
  });
});

describe('daily close for multi-day events', () => {
  const windows = [
    { day: '2026-10-15', start: '17:00', end: '21:00' },
    { day: '2026-10-16', start: '12:00', end: '18:00' },
  ];
  const ev = { start_date: '2026-10-16T00:00:00Z', end_date: '2026-10-17T01:00:00Z', checkin_windows: windows };
  it('is open before the day starts and during the day', () => {
    expect(dayHoursOverError(ev, at('2026-10-15T20:00:00Z'))).toBeNull(); // Oct 15 1:00 PM Pacific, before 5 PM
    expect(dayHoursOverError(ev, at('2026-10-16T03:00:00Z'))).toBeNull(); // Oct 15 8:00 PM Pacific
  });
  it("closes after that day's end time, to the minute", () => {
    expect(dayHoursOverError(ev, at('2026-10-16T04:00:00Z'))).toBeNull(); // 9:00 PM exactly: still open
    expect(dayHoursOverError(ev, at('2026-10-16T04:01:00Z'))).toMatch(/closed at 9:00 PM/); // 9:01 PM
  });
  it("opens again the next Pacific day and uses that day's hours", () => {
    expect(dayHoursOverError(ev, at('2026-10-16T07:30:00Z'))).toBeNull(); // Oct 16 12:30 AM Pacific, before day 2 starts
    expect(dayHoursOverError(ev, at('2026-10-16T20:00:00Z'))).toBeNull(); // Oct 16 1:00 PM Pacific
    expect(dayHoursOverError(ev, at('2026-10-17T01:30:00Z'))).toMatch(/closed at 6:00 PM/); // Oct 16 6:30 PM Pacific
  });
  it('a day without hours never closes early, and neither does a one-day event', () => {
    expect(dayHoursOverError(ev, at('2026-10-18T05:00:00Z'))).toBeNull();
    expect(dayHoursOverError({ checkin_windows: [] }, at('2026-10-16T05:00:00Z'))).toBeNull();
  });
  it('uses Pacific days across the daylight saving change', () => {
    const w = [{ day: '2026-11-01', start: '10:00', end: '14:00' }];
    expect(dayHoursOverError({ checkin_windows: w }, at('2026-11-01T22:00:00Z'))).toBeNull(); // 2:00 PM PST
    expect(dayHoursOverError({ checkin_windows: w }, at('2026-11-01T22:30:00Z'))).toMatch(/closed at 2:00 PM/); // 2:30 PM PST
  });
});

describe('the hours of each day', () => {
  const days = ['2026-10-15', '2026-10-16'];
  it('keeps only real days with a start before an end, sorted', () => {
    const list = [
      { day: '2026-10-16', start: '12:00', end: '18:00' },
      { day: '2026-10-15', start: '17:00', end: '21:00' },
      { day: '2026-10-17', start: '10:00', end: '11:00' },
      { day: '2026-10-15', start: '', end: '' },
    ];
    expect(cleanDayHours(list, days).map((w) => w.day)).toEqual(['2026-10-15', '2026-10-16']);
    expect(cleanDayHours(list, ['2026-10-15'])).toEqual([]); // a one-day event has none
  });
  it('is complete only when every day has a start before an end', () => {
    expect(dayHoursComplete([{ day: '2026-10-15', start: '17:00', end: '21:00' }], days)).toBe(false);
    expect(
      dayHoursComplete(
        [
          { day: '2026-10-15', start: '17:00', end: '21:00' },
          { day: '2026-10-16', start: '18:00', end: '12:00' },
        ],
        days,
      ),
    ).toBe(false);
    expect(
      dayHoursComplete(
        [
          { day: '2026-10-15', start: '17:00', end: '21:00' },
          { day: '2026-10-16', start: '12:00', end: '18:00' },
        ],
        days,
      ),
    ).toBe(true);
  });
  it('shows a day as a readable line', () => {
    expect(formatDayHours({ day: '2026-10-15', start: '17:00', end: '21:00' })).toBe('Thu, Oct 15 · 5:00 PM – 9:00 PM');
  });
  it('self check-in closes by the event hours, falling back to the scanner hours for a day without them', () => {
    const merged = closingHours(
      [{ day: '2026-10-15', start: '17:00', end: '21:00' }],
      [
        { day: '2026-10-15', start: '08:00', end: '23:00' },
        { day: '2026-10-16', start: '08:00', end: '20:00' },
      ],
    );
    expect(merged).toEqual([
      { day: '2026-10-15', start: '17:00', end: '21:00' },
      { day: '2026-10-16', start: '08:00', end: '20:00' },
    ]);
    const ev = { start_date: '2020-01-01T00:00:00Z', end_date: '2099-01-01T00:00:00Z', day_hours: [{ day: '2026-10-15', start: '17:00', end: '21:00' }], checkin_windows: [] };
    expect(selfCheckinClosedReason('until_end', ev, at('2026-10-16T04:01:00Z'))?.code).toBe('day_over'); // 9:01 PM Pacific on Oct 15
    expect(selfCheckinClosedReason('until_end', ev, at('2026-10-16T03:59:00Z'))).toBeNull(); // 8:59 PM
    expect(selfCheckinClosedReason('forever', ev, at('2026-10-16T04:01:00Z'))?.code).toBe('day_over'); // forever still closes a day with hours
  });
});
