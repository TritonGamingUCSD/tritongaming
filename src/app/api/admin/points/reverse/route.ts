import { createNotifications } from '@/lib/notifications/notify';
import { pointsText } from '@/lib/notifications/memberNotices';
import { logAudit } from '@/lib/notifications/audit';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { strictUser } from '@/lib/supabase/localAuth';

// Reverses one specific, known ledger entry — the precise alternative to
// the free-form Manual Point Adjustment tool, for whenever the exact
// transaction to undo is already known (browsed via /api/admin/points/history).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await strictUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { transaction_id } = await request.json();
  if (!transaction_id) return NextResponse.json({ error: 'Missing transaction_id' }, { status: 400 });

  const serviceClient = createServiceClient();
  const { data: txn } = await serviceClient.from('point_transactions').select('user_id, amount').eq('id', transaction_id).maybeSingle();
  const { error } = await serviceClient.rpc('reverse_point_transaction', {
    _transaction_id: transaction_id,
    _reversed_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(serviceClient, { actorId: user.id, action: 'reverse', entityType: 'points', entityId: transaction_id, summary: 'A points entry was reversed' });
  if (txn?.user_id && txn.user_id !== user.id) await createNotifications(serviceClient, [{ user_id: txn.user_id as string, type: 'points_reversed', title: `${pointsText(-Number(txn.amount))} (a points entry was reversed)`, body: 'An earlier points entry on your account was undone.', href: '/portal/points' }]);
  return NextResponse.json({ ok: true });
}
