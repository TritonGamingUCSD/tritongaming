import type { SupabaseClient } from '@supabase/supabase-js';

// How long notifications are kept. The bell only ever shows recent ones, so old rows are just weight in the table. Short-lived kinds go sooner:
//  - audit alerts ("Audit alert: delete ...") go after 14 days: the audit log itself keeps the record
//  - routine notices (ticket confirmed or checked in, meeting invite or reminder) go 14 days after they are read, and after 45 days whatever happens
//  - everything else (role changes, strikes, help replies, quarter status): once read it goes after 30 days; anything, read or not, after 90
export const KEEP_ALERT_DAYS = 14;
export const ROUTINE_TYPES = ['ticket_confirmed', 'ticket_checked_in', 'meeting_invite', 'meeting_reminder'];
export const KEEP_ROUTINE_READ_DAYS = 14;
export const KEEP_ROUTINE_ANY_DAYS = 45;
export const KEEP_READ_DAYS = 30;
export const KEEP_ANY_DAYS = 90;
const DAY = 86400_000;

export async function cleanupNotifications(svc: SupabaseClient, now = new Date()): Promise<{ read: number; old: number }> {
  const before = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  const n = () => svc.from('notifications').delete({ count: 'exact' });
  const { count: alerts } = await n().eq('type', 'audit_alert').lt('created_at', before(KEEP_ALERT_DAYS));
  const { count: routineRead } = await n().in('type', ROUTINE_TYPES).not('read_at', 'is', null).lt('created_at', before(KEEP_ROUTINE_READ_DAYS));
  const { count: routineAny } = await n().in('type', ROUTINE_TYPES).lt('created_at', before(KEEP_ROUTINE_ANY_DAYS));
  const { count: read } = await n().not('read_at', 'is', null).lt('created_at', before(KEEP_READ_DAYS));
  const { count: any } = await n().lt('created_at', before(KEEP_ANY_DAYS));
  return { read: (routineRead ?? 0) + (read ?? 0), old: (alerts ?? 0) + (routineAny ?? 0) + (any ?? 0) };
}
