import { describe, expect, test } from 'vitest';
import { reminderText, upcomingItems, type Item } from '@/lib/meetings/reminders';

const now = new Date('2026-10-31T16:00:00Z'); // 9:00 AM in San Diego
const item = (startsAt: string, over: Partial<Item> = {}): Item => ({
  key: startsAt,
  kind: 'meeting',
  title: 'Gen Meeting',
  starts_at: startsAt,
  location: null,
  audience: null,
  invitees: null,
  group_ids: null,
  href: '/portal/meetings/mine',
  skip: new Set(),
  ...over,
});

describe('which meetings are still to remind about', () => {
  const items = [item('2026-10-31T15:00:00Z'), item('2026-10-31T16:30:00Z'), item('2026-10-31T20:00:00Z'), item('2026-10-31T16:00:00Z')];
  test('only the ones that have not started', () => {
    expect(upcomingItems(items, now).map((i) => i.starts_at)).toEqual(['2026-10-31T16:30:00Z', '2026-10-31T20:00:00Z']);
  });
  test('with a limit, only the ones starting soon', () => {
    expect(upcomingItems(items, now, 90).map((i) => i.starts_at)).toEqual(['2026-10-31T16:30:00Z']);
  });
});

describe('the meeting reminder text', () => {
  test('the time is the San Diego one', () => {
    expect(reminderText(item('2026-11-01T01:00:00Z', { location: 'Center 220' }))).toEqual({ title: 'Gen Meeting is today at 6:00 PM', body: 'Where: Center 220' });
    expect(reminderText(item('2026-11-01T01:00:00Z')).body).toBeNull();
  });
});
