import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Powers the portal's notification bell. Rows are only ever written by
// trusted server-side code (ticket/check-in routes, admin_set_user_roles —
// see 20260920021310_add_notifications.sql) — this route is read-only.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, body, href, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ]);

  return NextResponse.json({ notifications: notifications ?? [], unreadCount: unreadCount ?? 0 });
}
