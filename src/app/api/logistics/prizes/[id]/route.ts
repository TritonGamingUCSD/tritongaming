import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { PRIZE_COLUMNS, ensureLoose, loadPrizeTotals, logPrize } from '@/lib/logistics/prizeServer';
import { cleanPrize, prizeLeft, type PrizePatch } from '@/lib/logistics/prizes';
import { UUID } from '@/lib/logistics/planServer';
import { announce, stockTopic, whoIs } from '@/lib/logistics/live';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// The prize inventory (every officer can look): each prize with how many are on hand, how many open events have promised (not yet given out), and how many are left to promise. Read when the
// Prizing page opens, not with the rest of Logistics.
// One prize: change it (PATCH; the number on hand with `expected_quantity`, saved as a correction) or remove it (DELETE).
// Changing the number on hand is how a recount is done: it is saved as a correction (with the reason if one was typed) in the prize's history.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  await ensureLoose(auth.svc);
  const b = { ...(await request.json().catch(() => ({}))), id };
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const r = cleanPrize(b, true);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const patch: PrizePatch & { updated_at: string; updated_by: string } = { ...r.value, updated_at: new Date().toISOString(), updated_by: auth.user.id };
  const { data: before } = await auth.svc.from('logistics_prizes').select('quantity, updated_by').eq('id', b.id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'That prize is gone.' }, { status: 404 });
  const countChanges = patch.quantity !== undefined && patch.quantity !== (before.quantity as number);
  // `expected_quantity` is the count the person was looking at: if someone else changed it meanwhile, nothing is changed and the answer says what it is now.
  if (countChanges && b.expected_quantity !== undefined && Math.round(Number(b.expected_quantity)) !== (before.quantity as number)) {
    const by = before.updated_by ? (await whoIs(auth.svc, before.updated_by as string)).name : 'Someone';
    return NextResponse.json(
      { code: 'changed', current: before.quantity, by, error: `${by} just changed the number on hand from ${Math.round(Number(b.expected_quantity))} to ${before.quantity}.` },
      { status: 409 },
    );
  }
  let q = auth.svc.from('logistics_prizes').update(patch).eq('id', b.id);
  if (countChanges) q = q.eq('quantity', before.quantity as number); // only if it is still the number just read
  const { data, error } = await q.select(PRIZE_COLUMNS).maybeSingle();
  if (error) return NextResponse.json({ error: 'Couldn’t save the prize.' }, { status: 500 });
  if (!data) {
    const { data: now } = await auth.svc.from('logistics_prizes').select('quantity, updated_by').eq('id', b.id).maybeSingle();
    if (!now) return NextResponse.json({ error: 'That prize is gone.' }, { status: 404 });
    const by = now.updated_by ? (await whoIs(auth.svc, now.updated_by as string)).name : 'Someone';
    return NextResponse.json({ code: 'changed', current: now.quantity, by, error: `${by} just changed the number on hand to ${now.quantity}.` }, { status: 409 });
  }
  const who = await whoIs(auth.svc, auth.user.id);
  if (countChanges) {
    await logPrize(auth.svc, [
      {
        prize_id: b.id,
        kind: 'correct',
        qty: (patch.quantity as number) - (before.quantity as number),
        note:
          String(b.note ?? '')
            .trim()
            .slice(0, 300) || null,
        actor: auth.user.id,
      },
    ]);
    await announce(stockTopic(), { k: 'stock', prize: b.id, qty: patch.quantity as number, was: before.quantity as number }, who);
  }
  if (Object.keys(r.value).some((k) => k !== 'quantity')) await announce(stockTopic(), { k: 'prizes' }, who); // details changed: the list is read again
  const t = (await loadPrizeTotals(auth.svc, [b.id])).get(b.id) ?? { allocated: 0 };
  return NextResponse.json({
    prize: { ...data, price: data.price === null ? null : Number(data.price), allocated: t.allocated, staffle: t.staffle ?? 0, left: prizeLeft(data as { quantity: number }, t) },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = { ...(await request.json().catch(() => ({}))), id };
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { count } = await auth.svc.from('logistics_plan_prizes').select('id', { count: 'exact', head: true }).eq('prize_id', b.id);
  if (count) return NextResponse.json({ error: `This prize is on ${count} prize line${count === 1 ? '' : 's'} at events. Take it off those first.` }, { status: 409 });
  const { count: inStaffle } = await auth.svc.from('staffle_items').select('id', { count: 'exact', head: true }).eq('prize_id', b.id);
  if (inStaffle)
    return NextResponse.json(
      { error: `This prize is in ${inStaffle} Staffle${inStaffle === 1 ? '' : 's'}. Take it out of ${inStaffle === 1 ? 'that one' : 'those'} first.` },
      { status: 409 },
    );
  const { data: p } = await auth.svc.from('logistics_prizes').select('name').eq('id', b.id).maybeSingle();
  await auth.svc.from('logistics_prizes').delete().eq('id', b.id);
  if (p) await logAudit(auth.svc, { actorId: auth.user.id, action: 'remove', entityType: 'logistics prize', entityId: b.id, summary: `Removed the prize “${p.name}”` });
  await announce(stockTopic(), { k: 'prizes' }, await whoIs(auth.svc, auth.user.id));
  return NextResponse.json({ ok: true });
}
