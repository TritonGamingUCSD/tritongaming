import type { SupabaseClient } from '@supabase/supabase-js';
import { pushNotifications } from '@/lib/notifications/webPush';

export interface NotificationInput { user_id: string; type: string; title: string; body?: string | null; href?: string | null }

// Adds notifications to the bell, and pushes them to the devices of members who turned web push on. One place for every notification the app
// creates on someone's behalf.
export async function createNotifications(svc: SupabaseClient, rows: NotificationInput[]): Promise<number> {
  rows = await onlyTestPeopleInDev(svc, rows);
  if (rows.length === 0) return 0;
  const { error } = await svc.from('notifications').insert(rows.map((r) => ({ user_id: r.user_id, type: r.type, title: r.title, body: r.body ?? null, href: r.href ?? null })));
  if (error) return 0;
  // Waited on (a serverless function stops once it responds), but never for long and never able to fail the caller.
  await Promise.race([pushNotifications(rows), new Promise((r) => setTimeout(r, 6000))]);
  return rows.length;
}

// A safety net for testing against the live database: with DEV_NOTIFY_TEST_ONLY=1 in .env.local, a development server only notifies accounts whose
// display name starts with "ZZ" (the throwaway test accounts), so a test can never message a real member. Never applies in production.
async function onlyTestPeopleInDev(svc: SupabaseClient, rows: NotificationInput[]): Promise<NotificationInput[]> {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_NOTIFY_TEST_ONLY !== '1' || rows.length === 0) return rows;
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data } = await svc.from('profiles').select('id').in('id', ids).like('display_name', 'ZZ%');
  const ok = new Set((data ?? []).map((p) => p.id as string));
  return rows.filter((r) => ok.has(r.user_id));
}
