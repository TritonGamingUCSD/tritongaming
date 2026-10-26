import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

// Who is holding a prize: the open events and stations that have promised some of it, so it is clear why "left" is low.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: lines } = await auth.svc.from('logistics_plan_prizes').select('plan_id, station_id, quantity').eq('prize_id', id).limit(500);
  const planIds = [...new Set((lines ?? []).map((l) => l.plan_id as string))];
  const poolIds = [...new Set((lines ?? []).map((l) => l.station_id as string))];
  const [plans, pools] = await Promise.all([
    planIds.length ? auth.svc.from('logistics_plans').select('id, name, status').in('id', planIds) : { data: [] as { id: string; name: string; status: string }[] },
    poolIds.length ? auth.svc.from('logistics_stations').select('id, name').in('id', poolIds) : { data: [] as { id: string; name: string }[] },
  ]);
  const plan = new Map((plans.data ?? []).map((p) => [p.id as string, p]));
  const pool = new Map((pools.data ?? []).map((p) => [p.id as string, p.name as string]));
  const holds = (lines ?? []).flatMap((l) => {
    const p = plan.get(l.plan_id as string);
    return p && p.status !== 'closed' ? [{ plan: p.name as string, station: pool.get(l.station_id as string) ?? 'a station', quantity: l.quantity as number }] : [];
  });
  return NextResponse.json({ holds });
}
