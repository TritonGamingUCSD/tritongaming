import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LOCKED_MESSAGE, poolLocked, UUID, touchPlan } from '@/lib/logistics/planServer';
import { loadPrizeTotals } from '@/lib/logistics/prizeServer';
import { prizeLeft } from '@/lib/logistics/prizes';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const qty = (v: unknown) => Math.round(Number(v));
const bad = (n: number) => !Number.isFinite(n) || n < 1 || n > 100000;
const COLUMNS = 'id, pool_id, prize_id, quantity, sort';

// Never promise more than there is: each prize's `add` (how many more a pool is asking for) can't be above what is left of it (in stock, minus what open events hold and what was given out).
// Lowering a pool's number is always allowed, so a prize that ended up over-promised (its stock was changed afterwards) can be fixed by lowering a pool.
async function noRoom(svc: SupabaseClient, wants: { prize_id: string; add: number }[]): Promise<string | null> {
  const need = new Map<string, number>();
  for (const w of wants) need.set(w.prize_id, (need.get(w.prize_id) ?? 0) + w.add);
  const ids = [...need].filter(([, n]) => n > 0).map(([id]) => id);
  if (!ids.length) return null;
  const [{ data: prizes }, totals] = await Promise.all([svc.from('logistics_prizes').select('id, name, quantity').in('id', ids), loadPrizeTotals(svc, ids)]);
  for (const p of prizes ?? []) {
    const left = prizeLeft(p as { quantity: number }, totals.get(p.id as string) ?? { allocated: 0, given: 0 });
    if ((need.get(p.id as string) ?? 0) > left) return `Only ${Math.max(0, left)} left of ${p.name}. That is not enough for ${need.get(p.id as string)} more.`;
  }
  return null;
}

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
  if (await poolLocked(auth.svc, id, b.pool_id)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const short = await noRoom(auth.svc, items.map((x) => ({ prize_id: x.prize_id, add: x.quantity })));
  if (short) return NextResponse.json({ error: short }, { status: 409 });
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
  const { data: line } = await auth.svc.from('logistics_plan_prizes').select('prize_id, quantity, pool_id').eq('id', b.line_id).eq('plan_id', id).maybeSingle();
  if (!line) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (await poolLocked(auth.svc, id, line.pool_id as string)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const short = await noRoom(auth.svc, [{ prize_id: line.prize_id as string, add: n - (line.quantity as number) }]);
  if (short) return NextResponse.json({ error: short }, { status: 409 });
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
  const { data: gone } = await auth.svc.from('logistics_plan_prizes').select('pool_id').eq('id', b.line_id).eq('plan_id', id).maybeSingle();
  if (gone && (await poolLocked(auth.svc, id, gone.pool_id as string))) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  await auth.svc.from('logistics_plan_prizes').delete().eq('id', b.line_id).eq('plan_id', id);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
