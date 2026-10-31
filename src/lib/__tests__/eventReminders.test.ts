import { describe, expect, test } from 'vitest';
import { reminderTitle } from '@/lib/notifications/eventReminders';

// 2026-10-31 is in daylight time (UTC-7): 16:00 UTC is 9:00 AM in San Diego.
const morning = new Date('2026-10-31T16:00:00Z');

describe('event reminder headline', () => {
  test('an event later the same Pacific day says today', () => {
    expect(reminderTitle('24h', 'Game Night', '2026-11-01T01:00:00Z', morning)).toBe('Game Night is today at 6:00 PM'); // 6 PM Oct 31
  });
  test('an event tomorrow says tomorrow, even when it is under 24 hours away', () => {
    expect(reminderTitle('24h', 'Game Night', '2026-11-01T16:00:00Z', morning)).toBe('Game Night is tomorrow at 8:00 AM'); // 25h away: clocks go back on Nov 1
    expect(reminderTitle('24h', 'Late One', '2026-11-01T08:00:00Z', morning)).toBe('Late One is tomorrow at 1:00 AM'); // 1 AM Nov 1: 17h away
  });
  test('the hour-before reminder keeps its own wording', () => {
    expect(reminderTitle('1h', 'Game Night', '2026-10-31T16:45:00Z', morning)).toBe('Game Night starts within the hour');
  });
});
