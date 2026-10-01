import { logAudit, currentActorId } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// Undoes a mis-scan or wrong-code check-in — flips the ticket back to
// active and reverses its point award (and the referral bonus, if that
// checkin was what triggered it). See reverse_checkin in
// 20260921080115_add_points_reversal_functions.sql.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { ticket_id } = await request.json();
  if (!ticket_id) return NextResponse.json({ error: 'Missing ticket_id' }, { status: 400 });

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc('reverse_checkin', { _ticket_id: ticket_id, _reversed_by: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(serviceClient, { actorId: user.id, action: 'reverse', entityType: 'check-in', entityId: ticket_id, summary: 'A check-in was undone' });

  return NextResponse.json({ ok: true });
}
