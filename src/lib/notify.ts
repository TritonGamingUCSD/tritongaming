import type { SupabaseClient } from '@supabase/supabase-js';
import { pushNotifications } from '@/lib/webPush';

export interface NotificationInput { user_id: string; type: string; title: string; body?: string | null; href?: string | null }

// Adds notifications to the bell, and pushes them to the devices of members who turned web push on. One place for every notification the app
// creates on someone's behalf.
export async function createNotifications(svc: SupabaseClient, rows: NotificationInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await svc.from('notifications').insert(rows.map((r) => ({ user_id: r.user_id, type: r.type, title: r.title, body: r.body ?? null, href: r.href ?? null })));
  if (error) return 0;
  // Waited on (a serverless function stops once it responds), but never for long and never able to fail the caller.
  await Promise.race([pushNotifications(rows), new Promise((r) => setTimeout(r, 6000))]);
  return rows.length;
}
