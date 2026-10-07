import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Powers the portal's notification bell. Rows are only ever written by
// trusted server-side code (ticket/check-in routes, admin_set_user_roles —
// see 20260920021310_add_notifications.sql) — this route is read-only.
// `?count=1` returns just the unread number (one tiny query): the bell checks that every couple of minutes and loads the list only when it changed.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (new URL(request.url).searchParams.get('count') === '1') {
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null);
    return NextResponse.json({ unreadCount: count ?? 0 });
  }

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
