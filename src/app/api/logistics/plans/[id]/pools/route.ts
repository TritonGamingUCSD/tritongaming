import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, touchPlan } from '@/lib/logistics/planServer';

export const dynamic = 'force-dynamic';
const name = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
const COLUMNS = 'id, name, station_id, sort';

// The team a pool is linked to, if it belongs to this plan.
async function stationOf(svc: import('@supabase/supabase-js').SupabaseClient, planId: string, v: unknown): Promise<string | null | false> {
  if (typeof v !== 'string' || !UUID.test(v)) return null;
  const { data } = await svc.from('logistics_stations').select('id').eq('id', v).eq('plan_id', planId).maybeSingle();
  return data ? (data.id as string) : false;
}

// Prize pools: the places prizes are given from at one event (a raffle, a game's prizes, a scavenger hunt), each optionally linked to one of the plan's teams. Made per plan.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const n = name(b.name);
  if (!n) return NextResponse.json({ error: 'Give the pool a name.' }, { status: 400 });
  const st = await stationOf(auth.svc, id, b.station_id);
  if (st === false) return NextResponse.json({ error: 'That team is gone.' }, { status: 400 });
  const { data: last } = await auth.svc.from('logistics_plan_pools').select('sort').eq('plan_id', id).order('sort', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await auth.svc.from('logistics_plan_pools').insert({ plan_id: id, name: n, station_id: st, sort: ((last?.sort as number | undefined) ?? 0) + 1 }).select(COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t add the pool.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ pool: data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.pool_id !== 'string' || !UUID.test(b.pool_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if ('name' in b) { const n = name(b.name); if (!n) return NextResponse.json({ error: 'The name can’t be empty.' }, { status: 400 }); patch.name = n; }
  if ('station_id' in b) { const st = await stationOf(auth.svc, id, b.station_id); if (st === false) return NextResponse.json({ error: 'That team is gone.' }, { status: 400 }); patch.station_id = st; }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { data, error } = await auth.svc.from('logistics_plan_pools').update(patch).eq('id', b.pool_id).eq('plan_id', id).select(COLUMNS).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ pool: data });
}

// Removing a pool removes its prize lines (and their step counts) from this plan; the prizes themselves stay in the inventory.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.pool_id !== 'string' || !UUID.test(b.pool_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await auth.svc.from('logistics_plan_pools').delete().eq('id', b.pool_id).eq('plan_id', id);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
