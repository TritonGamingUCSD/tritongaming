import type { SupabaseClient } from '@supabase/supabase-js';

// How long notifications are kept. The bell only ever shows recent ones, so old rows are just weight in the table:
//  - once someone has read it, it goes after 30 days
//  - anything, read or not, goes after 90 days (a notice nobody opened in three months is no longer news)
export const KEEP_READ_DAYS = 30;
export const KEEP_ANY_DAYS = 90;
const DAY = 86400_000;

export async function cleanupNotifications(svc: SupabaseClient, now = new Date()): Promise<{ read: number; old: number }> {
  const readBefore = new Date(now.getTime() - KEEP_READ_DAYS * DAY).toISOString();
  const anyBefore = new Date(now.getTime() - KEEP_ANY_DAYS * DAY).toISOString();
  const { count: read } = await svc.from('notifications').delete({ count: 'exact' }).not('read_at', 'is', null).lt('created_at', readBefore);
  const { count: old } = await svc.from('notifications').delete({ count: 'exact' }).lt('created_at', anyBefore);
  return { read: read ?? 0, old: old ?? 0 };
}
