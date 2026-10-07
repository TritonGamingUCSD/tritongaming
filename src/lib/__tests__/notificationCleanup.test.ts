import { describe, expect, it } from 'vitest';
import { KEEP_ANY_DAYS, KEEP_READ_DAYS, cleanupNotifications } from '@/lib/notifications/notificationCleanup';

// A tiny stand-in for the Supabase client that records what each delete was told to match.
function fakeSvc() {
  const calls: { table: string; filters: [string, ...unknown[]][] }[] = [];
  return {
    calls,
    svc: {
      from: (table: string) => ({
        delete: () => {
          const call = { table, filters: [] as [string, ...unknown[]][] }; calls.push(call);
          const chain = {
            not: (...a: unknown[]) => { call.filters.push(['not', ...a]); return chain; },
            lt: (...a: unknown[]) => { call.filters.push(['lt', ...a]); return Promise.resolve({ count: calls.length === 1 ? 7 : 2 }); },
          };
          return chain;
        },
      }),
    } as never,
  };
}

describe('notification cleanup', () => {
  it('deletes read notifications after 30 days, and anything after 90', async () => {
    const now = new Date('2026-10-03T12:00:00Z');
    const { svc, calls } = fakeSvc();
    const out = await cleanupNotifications(svc, now);
    expect(out).toEqual({ read: 7, old: 2 });
    expect(KEEP_READ_DAYS).toBe(30);
    expect(KEEP_ANY_DAYS).toBe(90);
    expect(calls.map((c) => c.table)).toEqual(['notifications', 'notifications']);
    // first: only READ ones (read_at is not null) older than 30 days
    expect(calls[0].filters[0]).toEqual(['not', 'read_at', 'is', null]);
    expect(calls[0].filters[1]).toEqual(['lt', 'created_at', '2026-09-03T12:00:00.000Z']);
    // second: anything (no read filter) older than 90 days
    expect(calls[1].filters).toEqual([['lt', 'created_at', '2026-07-05T12:00:00.000Z']]);
  });
});
