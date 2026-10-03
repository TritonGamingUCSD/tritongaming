import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeStrikes, cleanCategory, cleanReason, notYourOwn, notifyPerson, recordEvent, spendVoucher, trackedPeople } from '@/lib/strikes';

const UUID = /^[0-9a-f-]{36}$/i;

// Do something to one strike (exec, HR and admin; never on your own record). Everything except an edit needs a reason, which the person can read:
//   { action: 'edit', reason?, incident_date?, category? }  fix the wording of a strike
//   { action: 'remove', reason }                           take a strike away
//   { action: 'apply_voucher', voucher_id, reason }        remove a strike with one of that person's unused vouchers
//   { action: 'reinstate', reason }                        undo a removal (a voucher used on it becomes usable again)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Strike not found.' }, { status: 404 });
  const { data: s } = await auth.svc.from('strikes').select('*').eq('id', id).maybeSingle();
  if (!s) return NextResponse.json({ error: 'Strike not found.' }, { status: 404 });
  if (s.user_id === auth.user.id) return notYourOwn();
  const b = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const name = (await trackedPeople(auth.svc)).find((p) => p.id === s.user_id)?.name ?? 'someone';
  const log = (summary: string) => logAudit(auth.svc, { actorId: auth.user.id, action: String(b.action), entityType: 'strike', entityId: id, summary });
  const bad = (m: string, status = 400) => NextResponse.json({ error: m }, { status });
  const reason = cleanReason(b.reason);

  if (b.action === 'edit') {
    if (s.status === 'removed') return bad('A removed strike can’t be edited. Reinstate it first.');
    const patch: Record<string, unknown> = {};
    if ('reason' in b) { const r = cleanReason(b.reason, 300); if (!r) return bad('Write the reason for the strike.'); patch.reason = r; }
    if ('incident_date' in b) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.incident_date))) return bad('Pick the date it happened.'); patch.incident_date = b.incident_date; }
    if ('category' in b) patch.category = cleanCategory(b.category);
    if (!Object.keys(patch).length) return bad('Nothing to change.');
    await auth.svc.from('strikes').update(patch).eq('id', id);
    await log(`Edited a strike for ${name}`);
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'remove') {
    if (s.status !== 'published') return bad('Only a strike that’s on their record can be taken away.');
    if (!reason) return bad('Say why it’s being taken away. They’ll see this.');
    await auth.svc.from('strikes').update({ status: 'removed', removed_by: auth.user.id, removed_at: now, removed_how: 'taken', removed_note: reason }).eq('id', id);
    await recordEvent(auth.svc, { userId: s.user_id, kind: 'strike_removed', reason, actorId: auth.user.id, strikeId: id });
    await log(`Took away a strike from ${name}`);
    await notifyPerson(auth.svc, s.user_id, 'Your strikes were updated', 'A strike was taken off. Open your Profile, under Strikes.');
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'apply_voucher') {
    if (s.status !== 'published') return bad('A voucher can only be used on a strike that’s on their record.');
    if (!reason) return bad('Say why the voucher is being used. They’ll see this.');
    const { data: v } = await auth.svc.from('strike_vouchers').select('*').eq('id', String(b.voucher_id ?? '')).maybeSingle();
    if (!v || v.user_id !== s.user_id) return bad('That voucher isn’t this person’s.');
    if (v.used_at || v.removed_at) return bad('That voucher can’t be used.');
    if (!(await spendVoucher(auth.svc, v.id as string, id, auth.user.id, reason))) return bad('That voucher can’t be used.');
    await log(`Used a voucher to remove a strike for ${name}`);
    await notifyPerson(auth.svc, s.user_id, 'Your strikes were updated', 'A voucher was used to remove a strike. Open your Profile, under Strikes.');
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'reinstate') {
    if (s.status !== 'removed') return bad('Only a removed strike can be reinstated.');
    if (!reason) return bad('Say why it’s being put back. They’ll see this.');
    // A strike that a voucher removed gets its voucher back (the original was deleted when it was used, so they get a fresh one).
    if (s.removed_how === 'voucher') {
      const { data: back } = await auth.svc.from('strike_vouchers').insert({ user_id: s.user_id, reason: 'Returned when the strike was put back', created_by: auth.user.id }).select('id').single();
      if (back) await recordEvent(auth.svc, { userId: s.user_id, kind: 'voucher_given', reason: 'Returned when the strike was put back', actorId: auth.user.id, voucherId: back.id as string });
    }
    await auth.svc.from('strikes').update({ status: 'published', removed_by: null, removed_at: null, removed_how: null, removed_note: null, voucher_id: null }).eq('id', id);
    await recordEvent(auth.svc, { userId: s.user_id, kind: 'strike_reinstated', reason, actorId: auth.user.id, strikeId: id });
    await log(`Reinstated a strike for ${name}`);
    await notifyPerson(auth.svc, s.user_id, 'Your strikes were updated', 'A strike was reinstated. Open your Profile, under Strikes.');
    return NextResponse.json({ ok: true });
  }
  return bad('Say what to do with the strike.');
}
