import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, touchPlan } from '@/lib/logistics/planServer';

export const dynamic = 'force-dynamic';
const qty = (v: unknown) => Math.round(Number(v));
const bad = (n: number) => !Number.isFinite(n) || n < 1 || n > 100000;
const COLUMNS = 'id, pool_id, prize_id, quantity, sort';

// What a pool gets: this many of this prize. A prize can be in a pool once (change its number instead of adding it again); it can be in several pools, and in several events.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.pool_id !== 'string' || !UUID.test(b.pool_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const items: { prize_id: string; quantity: number }[] = (Array.isArray(b.items) ? b.items : [{ prize_id: b.prize_id, quantity: b.quantity }]).slice(0, 200).map((x: Record<string, unknown>) => ({ prize_id: String(x?.prize_id ?? ''), quantity: qty(x?.quantity) }));
  if (!items.length || items.some((x) => !UUID.test(x.prize_id) || bad(x.quantity))) return NextResponse.json({ error: 'Pick a prize and how many.' }, { status: 400 });
  const { data: pool } = await auth.svc.from('logistics_plan_pools').select('id').eq('id', b.pool_id).eq('plan_id', id).maybeSingle();
  if (!pool) return NextResponse.json({ error: 'That pool is gone.' }, { status: 404 });
  const { data: have } = await auth.svc.from('logistics_plan_prizes').select('prize_id, sort').eq('pool_id', b.pool_id);
  if (items.some((x) => (have ?? []).some((h) => h.prize_id === x.prize_id))) return NextResponse.json({ error: 'That prize is already in this pool. Change its number instead.' }, { status: 409 });
  let sort = Math.max(0, ...(have ?? []).map((h) => h.sort as number));
  const { data, error } = await auth.svc.from('logistics_plan_prizes').insert(items.map((x) => ({ plan_id: id, pool_id: b.pool_id, prize_id: x.prize_id, quantity: x.quantity, sort: ++sort }))).select(COLUMNS);
  if (error) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ lines: data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.line_id !== 'string' || !UUID.test(b.line_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const n = qty(b.quantity);
  if (bad(n)) return NextResponse.json({ error: 'How many has to be a whole number, 1 or more.' }, { status: 400 });
  const { data, error } = await auth.svc.from('logistics_plan_prizes').update({ quantity: n }).eq('id', b.line_id).eq('plan_id', id).select(COLUMNS).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  // A count can't be above how many there are now.
  const { data: steps } = await auth.svc.from('logistics_plan_prize_steps').select('step_id, done').eq('line_id', b.line_id).gt('done', n);
  for (const s of steps ?? []) await auth.svc.from('logistics_plan_prize_steps').update({ done: n }).eq('line_id', b.line_id).eq('step_id', s.step_id as string);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ line: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.line_id !== 'string' || !UUID.test(b.line_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await auth.svc.from('logistics_plan_prizes').delete().eq('id', b.line_id).eq('plan_id', id);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
