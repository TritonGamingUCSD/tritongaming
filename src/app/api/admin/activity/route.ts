import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';

// Backs the Admin overview's per-admin "recent activity" panel — see
// get_admin_activity in 20260921150000_add_admin_activity_feed.sql for
// what it does and doesn't cover. Gated the same as role_change_log
// itself (admin-only), since this surfaces other admins' actions.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc('get_admin_activity', { _admin_id: userId, _limit: 30 });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}
