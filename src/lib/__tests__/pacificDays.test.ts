import { describe, expect, test } from 'vitest';
import { addDaysKey, daysBetweenKeys, pacificDayKey, pacificDaysUntil, pacificToday } from '@/lib/core/timezone';
import { whenLabel } from '@/components/NextEventTicket/NextEventTicket';

describe('Pacific calendar days', () => {
  test('an instant belongs to the Pacific day, not the UTC day', () => {
    expect(pacificDayKey(new Date('2026-11-01T02:30:00Z'))).toBe('2026-10-31'); // 7:30 PM PDT on Oct 31
    expect(pacificDayKey('2026-11-01T08:00:00Z')).toBe('2026-11-01'); // 1:00 AM PDT
    expect(pacificToday(new Date('2026-07-04T06:59:00Z'))).toBe('2026-07-03'); // 11:59 PM PDT
  });
  test('adding days works on the date alone, across both clock changes', () => {
    expect(addDaysKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysKey('2026-11-01', 1)).toBe('2026-11-02'); // clocks go back: a 25-hour day
    expect(addDaysKey('2026-03-08', 1)).toBe('2026-03-09'); // clocks go forward: a 23-hour day
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01');
  });
  test('days between two calendar days', () => {
    expect(daysBetweenKeys('2026-10-31', '2026-11-03')).toBe(3);
    expect(daysBetweenKeys('2026-11-03', '2026-10-31')).toBe(-3);
    expect(daysBetweenKeys('2026-03-07', '2026-03-09')).toBe(2);
  });
  test('days until an event counts Pacific days at any hour', () => {
    const lateEvening = new Date('2026-11-01T06:30:00Z'); // 11:30 PM PDT on Oct 31
    expect(pacificDaysUntil('2026-11-01T08:00:00Z', lateEvening)).toBe(1); // 1 AM Nov 1: 90 minutes away, but tomorrow
    expect(pacificDaysUntil('2026-11-01T05:00:00Z', lateEvening)).toBe(0); // 10 PM Oct 31: already earlier tonight
  });
});

describe('the label on the next event', () => {
  const morning = new Date('2026-10-31T16:00:00Z'); // 9:00 AM PDT
  test('later today is Today, started is Happening now', () => {
    expect(whenLabel('2026-11-01T01:00:00Z', morning)).toBe('Today');
    expect(whenLabel('2026-10-31T15:00:00Z', morning)).toBe('Happening now');
  });
  test('tomorrow and later', () => {
    expect(whenLabel('2026-11-01T20:00:00Z', morning)).toBe('Tomorrow');
    expect(whenLabel('2026-11-05T20:00:00Z', morning)).toBe('In 5 days');
    expect(whenLabel('2026-11-30T20:00:00Z', morning)).toBe('In 4 weeks');
  });
});
