import { invalidate } from '@/lib/revalidate';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// Sets profiles.board_order = its index in the given array — the exec/
// lead display order shown on the public About page board section and
// the portal's Members tab (see getBoardMembers.ts / getMembersData.ts).
// Always re-sent as the caller's full current list rather than a single
// move, so this stays a plain "set these positions" call instead of
// needing swap/insert logic to reconcile concurrent edits.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { order } = await request.json();
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'order must be an array of user ids' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const results = await Promise.all(
    order.map((id: string, index: number) => serviceClient.from('profiles').update({ board_order: index }).eq('id', id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  invalidate('board', 'divisions');
  return NextResponse.json({ ok: true });
}
