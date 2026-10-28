import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';

export const dynamic = 'force-dynamic';

// What the device sheet needs about the open events (every officer can look): the events, their stations and which device is on which station (planned or backup), so a device's events show as columns.
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const svc = auth.svc;
  const { data: plans } = await svc.from('logistics_plans').select('id, slug, name, starts_on, ends_on').eq('status', 'draft').order('starts_on').limit(20);
  const ids = (plans ?? []).map((p) => p.id as string);
  if (!ids.length) return NextResponse.json({ plans: [], stations: [], items: [], canManage: auth.canManage });
  const [stations, items] = await Promise.all([
    svc.from('logistics_stations').select('id, plan_id, name').in('plan_id', ids).order('sort').limit(2000),
    svc.from('logistics_plan_devices').select('plan_id, device_id, station_id, role').in('plan_id', ids).limit(20000),
  ]);
  return NextResponse.json({ plans, stations: stations.data ?? [], items: items.data ?? [], canManage: auth.canManage });
}
