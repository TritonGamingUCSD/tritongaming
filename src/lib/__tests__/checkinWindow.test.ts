import { describe, expect, it } from 'vitest';
import { checkinHoursError, isCheckinWindowOpen } from '@/lib/events/checkinWindow';

// Pacific time in November is UTC-8.
const windows = [{ day: '2026-11-07', start: '10:00', end: '18:00' }];
const at = (iso: string) => checkinHoursError({ checkin_windows: windows }, new Date(iso));

describe('per-day check-in hours', () => {
  it('blocks before opening and after closing', () => {
    expect(at('2026-11-07T17:30:00Z')).toBe('Check-in for today opens at 10:00 AM.');
    expect(at('2026-11-08T02:30:00Z')).toBe('Check-in for today closed at 6:00 PM.');
  });
  it('allows inside the window, including the first minute', () => {
    expect(at('2026-11-07T18:00:00Z')).toBeNull();
    expect(at('2026-11-08T00:00:00Z')).toBeNull();
  });
  it('leaves days without hours (and events without any) open', () => {
    expect(at('2026-11-08T20:00:00Z')).toBeNull();
    expect(checkinHoursError({}, new Date())).toBeNull();
    expect(checkinHoursError({ checkin_windows: [] }, new Date())).toBeNull();
  });
});

describe('event check-in window', () => {
  it('stays open until the end time, or a day after the start with no end', () => {
    const now = Date.now();
    expect(isCheckinWindowOpen({ start_date: new Date(now - 3600_000).toISOString(), end_date: new Date(now + 3600_000).toISOString() })).toBe(true);
    expect(isCheckinWindowOpen({ start_date: new Date(now - 3 * 86400_000).toISOString(), end_date: null })).toBe(false);
  });
});
