import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { countAt, ensureLoose, loadPrizeSteps, loadPrizeTotals, stepKinds } from '@/lib/logistics/prizeServer';
import { isLoose, lineNumbers, prizeLeft } from '@/lib/logistics/prizes';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

// "Where did they go?" for one prize (every officer can look): how the count got to what it is (added, corrected by hand, given out, from the history), what each event has done with it (per station:
// promised, given out, counted back) and what open events still hold. `unexplained` is what the count has that the history does not account for, which is what a recount should settle.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await ensureLoose(auth.svc);
  const { data: prize } = await auth.svc.from('logistics_prizes').select('id, name, size, quantity, stock_level').eq('id', id).maybeSingle();
  if (!prize) return NextResponse.json({ error: 'That prize is gone.' }, { status: 404 });
  const [{ data: log }, { data: lines }, steps, totals] = await Promise.all([
    auth.svc.from('logistics_prize_log').select('kind, qty').eq('prize_id', id).limit(5000),
    auth.svc.from('logistics_plan_prizes').select('id, plan_id, station_id, quantity').eq('prize_id', id).limit(2000),
    loadPrizeSteps(auth.svc),
    loadPrizeTotals(auth.svc, [id]),
  ]);
  const sum = (kind: string) => (log ?? []).filter((e) => e.kind === kind).reduce((n, e) => n + (e.qty as number), 0);
  const added = sum('add'),
    corrected = sum('correct'),
    given = sum('give');
  const lineIds = (lines ?? []).map((l) => l.id as string);
  const planIds = [...new Set((lines ?? []).map((l) => l.plan_id as string))];
  const stationIds = [...new Set((lines ?? []).map((l) => l.station_id as string))];
  const [{ data: done }, { data: plans }, { data: stations }] = await Promise.all([
    lineIds.length
      ? auth.svc.from('logistics_plan_prize_steps').select('line_id, step_id, done').in('line_id', lineIds).limit(10000)
      : Promise.resolve({ data: [] as { line_id: string; step_id: string; done: number }[] }),
    planIds.length
      ? auth.svc.from('logistics_plans').select('id, name, slug, status, starts_on').in('id', planIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string; status: string; starts_on: string }[] }),
    stationIds.length ? auth.svc.from('logistics_stations').select('id, name').in('id', stationIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const { gives, back } = stepKinds(steps);
  const stationName = new Map((stations ?? []).map((s) => [s.id as string, s.name as string]));
  const events = (plans ?? [])
    .sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)))
    .map((p) => ({
      name: p.name as string,
      slug: p.slug as string,
      status: p.status as string,
      stations: (lines ?? [])
        .filter((l) => l.plan_id === p.id)
        .map((l) => {
          const n = lineNumbers(l.quantity as number, countAt(done, l.id as string, gives), countAt(done, l.id as string, back));
          return { station: stationName.get(l.station_id as string) ?? 'a station', promised: n.planned, given: n.given, back: n.back, planned: p.status === 'draft' ? n.held : 0 };
        }),
    }));
  const t = totals.get(id) ?? { allocated: 0 };
  return NextResponse.json({
    name: prize.name,
    loose: isLoose(prize as { size: string | null }),
    quantity: prize.quantity as number,
    planned: t.allocated,
    left: prizeLeft(prize as { quantity: number; size: string | null; stock_level: string }, t),
    added,
    corrected,
    given,
    unexplained: (prize.quantity as number) - (added + corrected + given),
    events,
  });
}
