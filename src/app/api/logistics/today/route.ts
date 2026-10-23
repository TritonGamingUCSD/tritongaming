import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { pacificToday } from '@/lib/logistics/planServer';

export const dynamic = 'force-dynamic';

// The events happening today, for the Dashboard's Event Day card: name, how far along the event-day steps are, and a few counts. Small on purpose (counts only, no devices).
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const svc = auth.svc;
  const today = pacificToday();
  let q = svc.from('logistics_plans').select('id, slug, name, starts_on, ends_on, status').eq('status', 'draft');
  q = q.lte('starts_on', today).gte('ends_on', today);
  const { data: plans } = await q.order('starts_on').limit(3);
  const out = [];
  for (const p of plans ?? []) {
    const pid = p.id as string;
    const [steps, devs, bor, stations, done, reqs] = await Promise.all([
      svc.from('logistics_options').select('id, meta').eq('kind', 'step'),
      svc.from('logistics_plan_devices').select('device_id', { count: 'exact', head: true }).eq('plan_id', pid).eq('role', 'planned'),
      svc.from('logistics_plan_borrowed').select('owner_kind').eq('plan_id', pid).eq('role', 'planned').limit(5000),
      svc.from('logistics_stations').select('id', { count: 'exact', head: true }).eq('plan_id', pid),
      svc.from('logistics_plan_steps').select('device_id', { count: 'exact', head: true }).eq('plan_id', pid),
      svc.from('logistics_requests').select('id', { count: 'exact', head: true }).eq('plan_id', pid).eq('status', 'submitted'),
    ]);
    const applies = (steps.data ?? []).map((s) => ((s.meta ?? {}) as { applies?: string }).applies ?? 'all');
    const forClub = applies.filter((a) => a === 'all' || a === 'club').length;
    const forLoaner = applies.filter((a) => a === 'all' || a === 'borrowed').length;
    const total = (devs.count ?? 0) * forClub + (bor.data ?? []).length * forLoaner;
    out.push({ id: pid, slug: p.slug as string, name: p.name as string, teams: stations.count ?? 0, devices: (devs.count ?? 0) + (bor.data ?? []).length, stepsDone: done.count ?? 0, stepsTotal: total, newRequests: reqs.count ?? 0 });
  }
  return NextResponse.json({ plans: out });
}
