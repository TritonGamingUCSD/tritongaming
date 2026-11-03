import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { countAt, ensureLoose, loadPrizeSteps, stepKinds } from '@/lib/logistics/prizeServer';
import { lineNumbers } from '@/lib/logistics/prizes';
import { PRIZES_CAN_CHANGE } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// Everything the prize sheet needs about the open events (every officer can look): the events, their stations, the prize steps and every prize line with its counts (and its planned, given out, back and held),
// so the sheet can show a prize's events as columns and open a prize to change its lines. One small read of each table, no matter how many prizes there are.
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const svc = auth.svc;
  await ensureLoose(svc);
  // The Staffles whose prizes can still change, and what each holds (so a prize's row can show and change them).
  const { data: openStaffles } = await svc.from('staffles').select('id, slug, name, status').in('status', PRIZES_CAN_CHANGE).order('created_at', { ascending: false }).limit(50);
  const staffleIds = (openStaffles ?? []).map((x) => x.id as string);
  const { data: staffleItems } = staffleIds.length
    ? await svc.from('staffle_items').select('staffle_id, prize_id, winners').in('staffle_id', staffleIds).limit(5000)
    : { data: [] };
  const staffles = {
    list: (openStaffles ?? []).map((x) => ({ slug: x.slug as string, name: x.name as string, status: x.status as string })),
    items: (staffleItems ?? []).map((i) => ({
      slug: (openStaffles ?? []).find((x) => x.id === i.staffle_id)?.slug as string,
      prize_id: i.prize_id as string,
      winners: i.winners as number,
    })),
  };
  const { data: plans } = await svc.from('logistics_plans').select('id, slug, name, starts_on, ends_on').eq('status', 'draft').order('starts_on').limit(20);
  const ids = (plans ?? []).map((p) => p.id as string);
  if (!ids.length) return NextResponse.json({ plans: [], stations: [], steps: [], lines: [], staffles, canManage: auth.canManage });
  const [stations, lines, done, steps] = await Promise.all([
    svc.from('logistics_stations').select('id, plan_id, name, prize_only').in('plan_id', ids).order('sort').limit(2000),
    svc.from('logistics_plan_prizes').select('id, plan_id, station_id, prize_id, quantity').in('plan_id', ids).limit(20000),
    svc.from('logistics_plan_prize_steps').select('line_id, step_id, done').in('plan_id', ids).limit(60000),
    loadPrizeSteps(svc),
  ]);
  const { gives, back } = stepKinds(steps);
  const counts = new Map<string, Record<string, number>>();
  for (const d of done.data ?? []) {
    const m = counts.get(d.line_id as string) ?? {};
    m[d.step_id as string] = d.done as number;
    counts.set(d.line_id as string, m);
  }
  return NextResponse.json({
    plans,
    stations: stations.data ?? [],
    steps,
    lines: (lines.data ?? []).map((l) => {
      const id = l.id as string,
        n = lineNumbers(l.quantity as number, countAt(done.data, id, gives), countAt(done.data, id, back));
      return {
        id,
        plan_id: l.plan_id,
        station_id: l.station_id,
        prize_id: l.prize_id,
        quantity: l.quantity,
        counts: counts.get(id) ?? {},
        given: n.given,
        back: n.back,
        held: n.held,
      };
    }),
    staffles,
    canManage: auth.canManage,
  });
}
