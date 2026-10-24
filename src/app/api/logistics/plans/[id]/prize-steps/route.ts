import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID } from '@/lib/logistics/planServer';
import { loadPrizeSteps } from '@/lib/logistics/prizeServer';
import { stepCeiling } from '@/lib/logistics/prizes';

export const dynamic = 'force-dynamic';

// Event-day count for a prize line: "sorted 6 of 10" is set as a number, any officer (like the device steps). The number can't pass how many the line has (a "back to storage" step can't pass
// how many were NOT given out). Setting it to 0 takes the step back.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.line_id !== 'string' || !UUID.test(b.line_id) || typeof b.step_id !== 'string' || !UUID.test(b.step_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const want = Math.round(Number(b.done));
  if (!Number.isFinite(want) || want < 0) return NextResponse.json({ error: 'Type a number, 0 or more.' }, { status: 400 });
  const [{ data: plan }, { data: line }, steps] = await Promise.all([
    auth.svc.from('logistics_plans').select('status').eq('id', id).maybeSingle(),
    auth.svc.from('logistics_plan_prizes').select('id, quantity').eq('id', b.line_id).eq('plan_id', id).maybeSingle(),
    loadPrizeSteps(auth.svc),
  ]);
  if (!plan || !line) return NextResponse.json({ error: 'That prize line is gone.' }, { status: 404 });
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
  const done = Math.min(want, ceiling);
  const { error } = await auth.svc.from('logistics_plan_prize_steps').upsert({ line_id: b.line_id, step_id: b.step_id, plan_id: id, done, updated_at: new Date().toISOString(), updated_by: auth.user.id }, { onConflict: 'line_id,step_id' });
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  // No touchPlan here: a count is not a change of the plan's makeup, and bumping the stamp would make every phone download the whole plan again. Other phones read the count from the version check.
  return NextResponse.json({ done, capped: want > ceiling });
}
