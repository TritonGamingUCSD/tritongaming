import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeStrikes, cleanReason, notifyPerson, notYourOwn, recordEvent, trackedPeople } from '@/lib/strikes';

// Reset strikes, usually once a quarter, for everyone or for one person with { user_id }. The old record is DELETED for good: every strike (the
// warning too), the history, questions people asked, dismissed misses, used and removed vouchers, and the strike entries in the audit log. Nobody
// can open it afterwards, admins included. Unused vouchers are kept. Needs a reason, which people then see as the only line left on their history.
// Nobody resets their own record: a bulk reset skips yours, and someone else has to clear it.
export async function POST(request: Request) {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const reason = cleanReason(b.reason);
  if (!reason) return NextResponse.json({ error: 'Say why, for example “Fall quarter reset”. People will see this.' }, { status: 400 });
  const one = b.user_id ? String(b.user_id) : null;
  if (one === auth.user.id) return notYourOwn();
  const people = await trackedPeople(auth.svc);
  if (one && !people.some((p) => p.id === one)) return NextResponse.json({ error: 'Strikes are only tracked for officers, leads and exec.' }, { status: 400 });
  const ids = (one ? [one] : people.map((p) => p.id)).filter((id) => id !== auth.user.id);
  if (!ids.length) return NextResponse.json({ ok: true, people: 0, strikes: 0 });

  const [{ data: strikeRows }, { data: spentVouchers }] = await Promise.all([
    auth.svc.from('strikes').select('id, user_id, status').in('user_id', ids),
    auth.svc.from('strike_vouchers').select('id').in('user_id', ids).or('used_at.not.is.null,removed_at.not.is.null'),
  ]);
  const strikeIds = (strikeRows ?? []).map((s) => s.id as string);
  const voucherIds = (spentVouchers ?? []).map((v) => v.id as string);
  const hadActive = [...new Set((strikeRows ?? []).filter((s) => s.status === 'published').map((s) => s.user_id as string))];

  // Delete the record (order matters: strikes before the vouchers that point at them), and remember when so old missed meetings don't come back.
  const now = new Date().toISOString();
  await auth.svc.from('strike_events').delete().in('user_id', ids);
  await auth.svc.from('strike_disputes').delete().in('user_id', ids);
  await auth.svc.from('strike_dismissals').delete().in('user_id', ids);
  await auth.svc.from('strikes').delete().in('user_id', ids);
  if (voucherIds.length) await auth.svc.from('strike_vouchers').delete().in('id', voucherIds);
  await auth.svc.from('strike_cleared').upsert(ids.map((user_id) => ({ user_id, cleared_at: now })), { onConflict: 'user_id' });
  // The audit log names people and reasons, so those lines go too. A bulk reset clears every strike line; a single one only that person's.
  if (one) {
    const gone = [...strikeIds, ...voucherIds];
    if (gone.length) await auth.svc.from('audit_log').delete().in('entity_type', ['strike', 'strike voucher']).in('entity_id', gone);
  } else {
    await auth.svc.from('audit_log').delete().in('entity_type', ['strike', 'strike voucher', 'strike request']);
  }

  // What people are left with: a single line saying their strikes were reset, and why.
  for (const uid of hadActive) {
    await recordEvent(auth.svc, { userId: uid, kind: 'strikes_reset', reason, actorId: auth.user.id });
    await notifyPerson(auth.svc, uid, 'Your strikes were reset', 'Open your Profile, under Strikes.');
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'reset', entityType: 'strike reset', entityId: null, summary: one ? 'Reset one person’s strikes' : `Reset strikes for everyone (${ids.length} ${ids.length === 1 ? 'person' : 'people'})` });
  return NextResponse.json({ ok: true, people: hadActive.length, strikes: strikeIds.length });
}
