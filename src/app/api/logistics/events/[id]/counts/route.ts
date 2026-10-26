import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID } from '@/lib/logistics/planServer';
import { bumpStock, loadPrizeSteps, logPrize } from '@/lib/logistics/prizeServer';
import { announce, planTopic, whoIs } from '@/lib/logistics/live';
import { stepCeiling } from '@/lib/logistics/prizes';

export const dynamic = 'force-dynamic';

// Event-day count for a prize line: "sorted 6 of 10", any officer (like the device steps). Two ways to change it:
//   { add: 1 }      a tap: added on the server in one statement, so two phones tapping at the same moment both count
//   { done: 6 }     a typed number (with `expected`, the number the person was looking at: if someone else changed it meanwhile, nothing is changed and the answer says what it is now)
// The number can't pass how many the line has (a "back to storage" step can't pass how many were NOT given out). Setting it to 0 takes the step back.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.line_id !== 'string' || !UUID.test(b.line_id) || typeof b.step_id !== 'string' || !UUID.test(b.step_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const adding = b.add !== undefined;
  const want = Math.round(Number(adding ? b.add : b.done));
  if (!Number.isFinite(want) || (!adding && want < 0) || (adding && Math.abs(want) > 1000)) return NextResponse.json({ error: 'Type a number, 0 or more.' }, { status: 400 });
  const [{ data: plan }, { data: line }, steps] = await Promise.all([
    auth.svc.from('logistics_plans').select('status, name').eq('id', id).maybeSingle(),
    auth.svc.from('logistics_plan_prizes').select('id, quantity, prize_id, station_id').eq('id', b.line_id).eq('plan_id', id).maybeSingle(),
    loadPrizeSteps(auth.svc),
  ]);
  if (!plan || !line) return NextResponse.json({ code: 'gone', error: 'That prize line is gone.' }, { status: 404 });
  if (plan.status === 'closed') return NextResponse.json({ error: 'This plan is closed.' }, { status: 409 });
  const step = steps.find((s) => s.id === b.step_id);
  if (!step) return NextResponse.json({ error: 'That step is gone.' }, { status: 404 });
  let givenOut = 0;
  if (step.leftover) {
    const gives = steps.filter((s) => s.gives).map((s) => s.id);
    if (gives.length) {
      const { data: g } = await auth.svc.from('logistics_plan_prize_steps').select('done').eq('line_id', b.line_id).in('step_id', gives);
      givenOut = (g ?? []).reduce((n, r) => n + (r.done as number), 0);
    }
  }
  const ceiling = stepCeiling(step, { quantity: line.quantity as number }, givenOut);
  let delta = want;
  if (!adding) {
    const { data: cur } = await auth.svc.from('logistics_plan_prize_steps').select('done, updated_by').eq('line_id', b.line_id).eq('step_id', b.step_id).maybeSingle();
    const now = (cur?.done as number | undefined) ?? 0;
    if (b.expected !== undefined && Math.round(Number(b.expected)) !== now) {
      const by = cur?.updated_by ? (await whoIs(auth.svc, cur.updated_by as string)).name : 'Someone';
      return NextResponse.json({ code: 'changed', current: now, by, error: `${by} just changed this from ${Math.round(Number(b.expected))} to ${now}.` }, { status: 409 });
    }
    delta = Math.min(want, ceiling) - now;
  }
  const { data: res, error } = await auth.svc.rpc('logistics_prize_step_add', { p_line: b.line_id, p_step: b.step_id, p_plan: id, p_delta: delta, p_cap: ceiling, p_user: auth.user.id });
  const row = (Array.isArray(res) ? res[0] : res) as { old_done: number; new_done: number } | undefined;
  if (error || !row) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  const who = await whoIs(auth.svc, auth.user.id);
  // A "gives" step takes stock out as it is counted (and puts it back when the count is lowered): what was given out is gone from the shelf.
  if (step.gives && row.new_done !== row.old_done) {
    const change = row.new_done - row.old_done;
    await bumpStock(auth.svc, line.prize_id as string, -change, who);
    const { data: st } = await auth.svc.from('logistics_stations').select('name').eq('id', line.station_id as string).maybeSingle();
    await logPrize(auth.svc, [{ prize_id: line.prize_id as string, kind: 'give', qty: -change, plan_id: id, plan_name: plan.name as string, station: (st?.name as string | undefined) ?? null, actor: auth.user.id }]);
  }
  if (row.new_done !== row.old_done) await announce(planTopic(id), { k: 'count', plan: id, line: b.line_id, step: b.step_id, done: row.new_done }, who);
  // No stamp on the plan here: a count is not a change of the plan's makeup, and bumping the stamp would make every phone download the whole plan again.
  return NextResponse.json({ done: row.new_done, capped: !adding && Math.round(Number(b.done)) > ceiling });
}
