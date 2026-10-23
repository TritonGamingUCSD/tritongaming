import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, touchPlan } from '@/lib/logistics/planServer';
import { planPrizeCounts } from '@/lib/logistics/prizeServer';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// The Keep list of an event: prizes set aside on purpose to be used at future events. Putting one on the list changes nothing about stock (it may still be used during the event). Only after the event
// is closed can a prize be moved to inventory, by hand, which is what puts it back in stock; the amount moved is at most what was not given out.
async function planOf(svc: Parameters<typeof touchPlan>[0], id: string) {
  const { data } = await svc.from('logistics_plans').select('id, name, status, manual_return').eq('id', id).maybeSingle();
  return data as { id: string; name: string; status: string; manual_return: boolean } | null;
}

// Set how many of a prize to keep (1 or more) for future events.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const n = Math.round(Number(b.quantity));
  if (!UUID.test(id) || typeof b.prize_id !== 'string' || !UUID.test(b.prize_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!Number.isFinite(n) || n < 1 || n > 100000) return NextResponse.json({ error: 'How many has to be a whole number, 1 or more.' }, { status: 400 });
  const plan = await planOf(auth.svc, id);
  if (!plan) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
  if (!plan.manual_return) return NextResponse.json({ error: 'This event was closed before the Keep list existed; its leftover prizes already count as in stock.' }, { status: 409 });
  const have = (await planPrizeCounts(auth.svc, id)).get(b.prize_id);
  if (!have) return NextResponse.json({ error: 'That prize isn’t in this event.' }, { status: 400 });
  if (n > have.quantity) return NextResponse.json({ error: `This event only has ${have.quantity} of that prize.` }, { status: 400 });
  const { data: cur } = await auth.svc.from('logistics_plan_keeps').select('moved_at').eq('plan_id', id).eq('prize_id', b.prize_id).maybeSingle();
  if (cur?.moved_at) return NextResponse.json({ error: 'That prize was already moved to inventory.' }, { status: 409 });
  const { error } = await auth.svc.from('logistics_plan_keeps').upsert({ plan_id: id, prize_id: b.prize_id, quantity: n, added_by: auth.user.id }, { onConflict: 'plan_id,prize_id' });
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ keep: { prize_id: b.prize_id, quantity: n, moved_at: null } }, { status: 201 });
}

// Take a prize off the list (not possible once it was moved).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.prize_id !== 'string' || !UUID.test(b.prize_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: cur } = await auth.svc.from('logistics_plan_keeps').select('moved_at').eq('plan_id', id).eq('prize_id', b.prize_id).maybeSingle();
  if (cur?.moved_at) return NextResponse.json({ error: 'That prize was already moved to inventory.' }, { status: 409 });
  await auth.svc.from('logistics_plan_keeps').delete().eq('plan_id', id).eq('prize_id', b.prize_id);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}

// Move kept prizes to inventory (one prize, or all of them), only after the event is closed. A prize is moved for at most what was not given out; if all of it was given out, it can't be moved.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const plan = await planOf(auth.svc, id);
  if (!plan) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
  if (plan.status !== 'closed') return NextResponse.json({ error: 'Close the event first. Kept prizes are moved to inventory after it, since they may still be used during it.' }, { status: 409 });
  if (!plan.manual_return) return NextResponse.json({ error: 'This event was closed before the Keep list existed.' }, { status: 409 });
  const only = typeof b.prize_id === 'string' && UUID.test(b.prize_id) ? b.prize_id : null;
  let q = auth.svc.from('logistics_plan_keeps').select('prize_id, quantity').eq('plan_id', id).is('moved_at', null);
  if (only) q = q.eq('prize_id', only);
  const { data: keeps } = await q;
  if (!keeps?.length) return NextResponse.json({ error: 'Nothing to move.' }, { status: 400 });
  const counts = await planPrizeCounts(auth.svc, id);
  let movedTotal = 0;
  const skipped: string[] = [];
  for (const k of keeps) {
    const c = counts.get(k.prize_id as string);
    const room = c ? c.quantity - c.given : 0;
    const n = Math.min(k.quantity as number, room);
    if (n < 1) { skipped.push(k.prize_id as string); continue; }
    await auth.svc.from('logistics_plan_keeps').update({ quantity: n, moved_at: new Date().toISOString(), moved_by: auth.user.id }).eq('plan_id', id).eq('prize_id', k.prize_id as string);
    movedTotal += n;
  }
  if (!movedTotal) return NextResponse.json({ error: 'All of it was given out, so there is nothing to move.' }, { status: 409 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'logistics prize', summary: `Moved ${movedTotal} kept prize${movedTotal === 1 ? '' : 's'} from “${plan.name}” to inventory` });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ moved: movedTotal, skipped });
}
