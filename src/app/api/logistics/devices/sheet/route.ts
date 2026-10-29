import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { loadSteps } from '@/lib/logistics/planServer';
import { stepsFor } from '@/lib/logistics/plans';

export const dynamic = 'force-dynamic';

// What the device sheet needs about the open events (every officer can look): the events, their stations and which device is on which station (planned or backup), and the event-day steps with which are done for a club device, so a device's events show as columns.
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const svc = auth.svc;
  const { data: plans } = await svc.from('logistics_plans').select('id, slug, name, starts_on, ends_on').eq('status', 'draft').order('starts_on').limit(20);
  const ids = (plans ?? []).map((p) => p.id as string);
  if (!ids.length) return NextResponse.json({ plans: [], stations: [], items: [], steps: [], done: [], canManage: auth.canManage });
  const [stations, items, steps, done] = await Promise.all([
    svc.from('logistics_stations').select('id, plan_id, name').in('plan_id', ids).order('sort').limit(2000),
    svc.from('logistics_plan_devices').select('plan_id, device_id, station_id, role').in('plan_id', ids).limit(20000),
    loadSteps(svc),
    svc.from('logistics_plan_steps').select('plan_id, device_id, step_id').in('plan_id', ids).not('device_id', 'is', null).limit(60000),
  ]);
  return NextResponse.json({
    plans,
    stations: stations.data ?? [],
    items: items.data ?? [],
    steps: stepsFor(steps, 'club').map((s) => ({ id: s.id, name: s.name })),
    done: done.data ?? [],
    canManage: auth.canManage,
  });
}
