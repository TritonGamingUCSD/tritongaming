import { logAudit, currentActorId } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// Mirrors /api/admin/battlepass/award — accepts multiple members at once,
// all credited the same amount in a single call.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { user_ids, amount, note } = await request.json();
  const parsedAmount = Math.round(Number(amount));
  const ids = Array.isArray(user_ids) ? user_ids.filter(Boolean) : [];
  if (ids.length === 0 || !parsedAmount || !note || !String(note).trim()) {
    return NextResponse.json({ error: 'At least one member, a non-zero amount, and a note are all required.' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc('admin_award_points', {
    _user_ids: ids,
    _amount: parsedAmount,
    _note: String(note).trim(),
    _admin_id: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(serviceClient, { actorId: user.id, action: 'award', entityType: 'points', summary: `${parsedAmount >= 0 ? '+' : ''}${parsedAmount} points awarded to ${ids.length} member${ids.length === 1 ? '' : 's'}: ${String(note).trim()}`, details: { amount: parsedAmount, recipients: ids.length } });
  return NextResponse.json({ ok: true, count: ids.length });
}
