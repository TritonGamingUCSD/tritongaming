import { describe, expect, it } from 'vitest';
import { KEEP_ALERT_DAYS, KEEP_ANY_DAYS, KEEP_READ_DAYS, KEEP_ROUTINE_ANY_DAYS, KEEP_ROUTINE_READ_DAYS, ROUTINE_TYPES, cleanupNotifications } from '@/lib/notifications/notificationCleanup';
import { KEEP_REACTION_DAYS, cleanupMeetingReactions } from '@/lib/meetings/reactionCleanup';

// A tiny stand-in for the Supabase client that records what each delete was told to match, and answers each with the next count in the list.
function fakeSvc(counts: number[]) {
  const calls: { table: string; filters: [string, ...unknown[]][] }[] = [];
  return {
    calls,
    svc: {
      from: (table: string) => ({
        delete: () => {
          const call = { table, filters: [] as [string, ...unknown[]][] }; calls.push(call);
          const at = calls.length - 1;
          const chain: Record<string, (...a: unknown[]) => unknown> = {
            eq: (...a) => { call.filters.push(['eq', ...a]); return chain; },
            in: (...a) => { call.filters.push(['in', ...a]); return chain; },
            not: (...a) => { call.filters.push(['not', ...a]); return chain; },
            lt: (...a) => { call.filters.push(['lt', ...a]); return Promise.resolve({ count: counts[at] }); },
          };
          return chain;
        },
      }),
    } as never,
  };
}

describe('notification cleanup', () => {
  it('keeps alerts 14 days, routine notices 14 days once read and 45 at most, the rest 30 once read and 90 at most', async () => {
    const now = new Date('2026-10-03T12:00:00Z');
    const { svc, calls } = fakeSvc([5, 4, 3, 2, 1]);
    const out = await cleanupNotifications(svc, now);
    expect(out).toEqual({ read: 4 + 2, old: 5 + 3 + 1 });
    expect([KEEP_ALERT_DAYS, KEEP_ROUTINE_READ_DAYS, KEEP_ROUTINE_ANY_DAYS, KEEP_READ_DAYS, KEEP_ANY_DAYS]).toEqual([14, 14, 45, 30, 90]);
    expect(calls.every((c) => c.table === 'notifications')).toBe(true);
    expect(calls[0].filters).toEqual([['eq', 'type', 'audit_alert'], ['lt', 'created_at', '2026-09-19T12:00:00.000Z']]);
    expect(calls[1].filters).toEqual([['in', 'type', ROUTINE_TYPES], ['not', 'read_at', 'is', null], ['lt', 'created_at', '2026-09-19T12:00:00.000Z']]);
    expect(calls[2].filters).toEqual([['in', 'type', ROUTINE_TYPES], ['lt', 'created_at', '2026-08-19T12:00:00.000Z']]);
    expect(calls[3].filters).toEqual([['not', 'read_at', 'is', null], ['lt', 'created_at', '2026-09-03T12:00:00.000Z']]);
    expect(calls[4].filters).toEqual([['lt', 'created_at', '2026-07-05T12:00:00.000Z']]);
  });
});

describe('meeting reaction cleanup', () => {
  it('removes individual reactions after a week', async () => {
    const { svc, calls } = fakeSvc([12]);
    expect(await cleanupMeetingReactions(svc, new Date('2026-10-15T00:00:00Z'))).toEqual({ removed: 12 });
    expect(KEEP_REACTION_DAYS).toBe(7);
    expect(calls[0]).toEqual({ table: 'meeting_reactions', filters: [['lt', 'created_at', '2026-10-08T00:00:00.000Z']] });
  });
});
