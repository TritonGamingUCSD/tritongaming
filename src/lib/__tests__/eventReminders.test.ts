import { describe, expect, test } from 'vitest';
import { dueReminders, reminderBody, reminderTitle, type TicketRow } from '@/lib/notifications/eventReminders';

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
  test('an event tomorrow evening, more than 24 hours away, is still tomorrow', () => {
    expect(reminderTitle('24h', 'Finals Jam', '2026-11-02T03:00:00Z', morning)).toBe('Finals Jam is tomorrow at 7:00 PM'); // 7 PM PST Nov 1, 35h away
  });
  test('the hour-before reminder keeps its own wording', () => {
    expect(reminderTitle('1h', 'Game Night', '2026-10-31T16:45:00Z', morning)).toBe('Game Night starts within the hour');
  });
});

describe('which tickets are due a reminder', () => {
  const now = new Date('2026-10-31T16:00:00Z');
  const row = (startsInHours: number, over: Partial<TicketRow> = {}, published = true): TicketRow => ({
    id: `t${startsInHours}`,
    user_id: 'u',
    reminder_24h_sent_at: null,
    reminder_1h_sent_at: null,
    event: {
      id: 'e',
      title: 'E',
      start_date: new Date(now.getTime() + startsInHours * 3600_000).toISOString(),
      location: null,
      is_online: false,
      slug: null,
      is_published: published,
    },
    ...over,
  });
  const kinds = (rows: TicketRow[]) => dueReminders(rows, now).map((d) => `${d.ticket.id}:${d.kind}`);
  test('far events get the day-before one, once', () => {
    expect(kinds([row(30), row(30, { reminder_24h_sent_at: 'x' })])).toEqual(['t30:24h']);
  });
  test('an event within 90 minutes gets the hour-before one, even if the day-before was never sent', () => {
    expect(kinds([row(1), row(1.5), row(1.6)])).toEqual(['t1:1h', 't1.5:1h']);
  });
  test('nothing in the gap or for an unpublished event', () => {
    expect(kinds([row(2), row(30, {}, false)])).toEqual([]);
  });
});

describe('the reminder text', () => {
  test('when and where, online or at a place', () => {
    expect(reminderBody({ start_date: '2026-11-01T01:00:00Z', location: 'Price Center', is_online: false })).toBe('Sat, Oct 31, 6:00 PM · Price Center. Have your QR code ready.');
    expect(reminderBody({ start_date: '2026-11-01T01:00:00Z', location: 'x', is_online: true })).toBe('Sat, Oct 31, 6:00 PM · Online. Have your QR code ready.');
    expect(reminderBody({ start_date: '2026-11-01T01:00:00Z', location: null, is_online: false })).toBe('Sat, Oct 31, 6:00 PM. Have your QR code ready.');
  });
});
