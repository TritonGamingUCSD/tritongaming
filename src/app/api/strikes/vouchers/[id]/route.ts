import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeStrikes, cleanReason, notYourOwn, notifyPerson, recordEvent } from '@/lib/strikes';

const UUID = /^[0-9a-f-]{36}$/i;

// Take back a voucher that hasn't been used, with a reason. It stays on record (marked removed) so the person can see what happened and why.
// A voucher that was already used can't be taken back: reinstate the strike it removed instead.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Voucher not found.' }, { status: 404 });
  const { data: v } = await auth.svc.from('strike_vouchers').select('user_id, used_at, removed_at').eq('id', id).maybeSingle();
  if (!v) return NextResponse.json({ error: 'Voucher not found.' }, { status: 404 });
  if (v.user_id === auth.user.id) return notYourOwn();
  if (v.used_at) return NextResponse.json({ error: 'A voucher that was used can’t be taken back. Reinstate the strike instead.' }, { status: 400 });
  if (v.removed_at) return NextResponse.json({ error: 'That voucher was already removed.' }, { status: 400 });
  const reason = cleanReason((await request.json().catch(() => ({}))).reason);
  if (!reason) return NextResponse.json({ error: 'Say why it’s being removed. They’ll see this.' }, { status: 400 });
  const { data: done } = await auth.svc.from('strike_vouchers').update({ removed_at: new Date().toISOString(), removed_by: auth.user.id, removed_reason: reason }).eq('id', id).is('used_at', null).is('removed_at', null).select('id');
  if (!done?.length) return NextResponse.json({ error: 'That voucher can’t be removed any more.' }, { status: 400 });
  await recordEvent(auth.svc, { userId: v.user_id as string, kind: 'voucher_removed', reason, actorId: auth.user.id, voucherId: id });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'strike voucher', entityId: id, summary: 'Removed an unused strike voucher' });
  await notifyPerson(auth.svc, v.user_id as string, 'Your strikes were updated', 'A voucher was removed. Open your Profile, under Strikes.');
  return NextResponse.json({ ok: true });
}
