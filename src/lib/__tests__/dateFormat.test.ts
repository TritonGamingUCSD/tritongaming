import { describe, expect, it } from 'vitest';
import { formatPacificDate, formatPacificDateTime, formatPacificTime } from '@/lib/core/timezone';

describe('date and time formats', () => {
  it('shows a calendar day as that same day', () => {
    expect(formatPacificDate('2026-10-31')).toBe('Oct 31');
    expect(formatPacificDate('2026-10-31', { weekday: true })).toBe('Sat, Oct 31');
    expect(formatPacificDate('2026-10-31', { year: true })).toBe('Oct 31, 2026');
  });
  it('reads an instant in Pacific time', () => {
    expect(formatPacificDate('2026-11-01T03:30:00Z')).toBe('Oct 31');
    expect(formatPacificTime('2026-11-01T00:00:00Z')).toBe('5:00 PM');
    expect(formatPacificTime('2026-11-01T00:00:05Z', { seconds: true })).toBe('5:00:05 PM');
    expect(formatPacificDateTime('2026-11-01T00:00:00Z')).toBe('Oct 31, 5:00 PM');
  });
});
