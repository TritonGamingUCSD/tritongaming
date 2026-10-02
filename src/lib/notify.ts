import type { SupabaseClient } from '@supabase/supabase-js';

export interface NotificationInput { user_id: string; type: string; title: string; body?: string | null; href?: string | null }

// Adds notifications to the bell. One place for every notification the app creates on someone's behalf.
export async function createNotifications(svc: SupabaseClient, rows: NotificationInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await svc.from('notifications').insert(rows.map((r) => ({ user_id: r.user_id, type: r.type, title: r.title, body: r.body ?? null, href: r.href ?? null })));
  return error ? 0 : rows.length;
}
