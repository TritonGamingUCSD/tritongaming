import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { PRIZE_COLUMNS, loadPrizeTotals } from '@/lib/logistics/prizeServer';
import { cleanPrize, prizeLeft, type PrizePatch } from '@/lib/logistics/prizes';
import { UUID } from '@/lib/logistics/planServer';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// The prize inventory (every officer can look): each prize with how many are promised to open plans, how many have been given out, and how many are left, and the name of the event
// it was sent for. Read when the Prizes tab (or a plan's prize picker) opens, not with the rest of Logistics.
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const [{ data: prizes, error }, totals] = await Promise.all([
    auth.svc.from('logistics_prizes').select(PRIZE_COLUMNS).order('name').limit(5000),
    loadPrizeTotals(auth.svc),
  ]);
  if (error) return NextResponse.json({ error: 'Couldn’t load the prizes.' }, { status: 500 });
  const planIds = [...new Set((prizes ?? []).map((p) => p.plan_id as string | null).filter((x): x is string => !!x))];
  const { data: plans } = planIds.length ? await auth.svc.from('logistics_plans').select('id, name').in('id', planIds) : { data: [] };
  const names = new Map((plans ?? []).map((p) => [p.id as string, p.name as string]));
  return NextResponse.json({
    prizes: (prizes ?? []).map((p) => {
      const t = totals.get(p.id as string) ?? { allocated: 0, given: 0 };
      return { ...p, price: p.price === null ? null : Number(p.price), allocated: t.allocated, given: t.given, left: prizeLeft(p as { quantity: number }, t), event: p.plan_id ? names.get(p.plan_id as string) ?? null : null };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const r = cleanPrize(await request.json().catch(() => ({})), false);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const { data, error } = await auth.svc.from('logistics_prizes').insert({ ...r.value, created_by: auth.user.id }).select(PRIZE_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t add the prize.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'logistics prize', entityId: data.id as string, summary: `Added the prize “${data.name}”` });
  return NextResponse.json({ prize: { ...data, price: data.price === null ? null : Number(data.price), allocated: 0, given: 0, left: data.quantity, event: null } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const r = cleanPrize(b, true);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const patch: PrizePatch & { updated_at: string } = { ...r.value, updated_at: new Date().toISOString() };
  const { data, error } = await auth.svc.from('logistics_prizes').update(patch).eq('id', b.id).select(PRIZE_COLUMNS).maybeSingle();
  if (error) return NextResponse.json({ error: 'Couldn’t save the prize.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'That prize is gone.' }, { status: 404 });
  const t = (await loadPrizeTotals(auth.svc, [b.id])).get(b.id) ?? { allocated: 0, given: 0 };
  return NextResponse.json({ prize: { ...data, price: data.price === null ? null : Number(data.price), allocated: t.allocated, given: t.given, left: prizeLeft(data as { quantity: number }, t) } });
}

export async function DELETE(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { count } = await auth.svc.from('logistics_plan_prizes').select('id', { count: 'exact', head: true }).eq('prize_id', b.id);
  if (count) return NextResponse.json({ error: `This prize is on ${count} prize line${count === 1 ? '' : 's'} at events. Take it off those first.` }, { status: 409 });
  const { data: p } = await auth.svc.from('logistics_prizes').select('name').eq('id', b.id).maybeSingle();
  await auth.svc.from('logistics_prizes').delete().eq('id', b.id);
  if (p) await logAudit(auth.svc, { actorId: auth.user.id, action: 'remove', entityType: 'logistics prize', entityId: b.id, summary: `Removed the prize “${p.name}”` });
  return NextResponse.json({ ok: true });
}
