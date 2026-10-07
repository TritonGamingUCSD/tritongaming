import { NextResponse } from 'next/server';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { authorizePlans, busyBlocksFor, planPeople, type PlanRow } from '@/lib/meetings/meetingPlanServer';
import { cleanSlots, planDayKeys, slotStarts, withoutBusy, type PlanSlots } from '@/lib/meetings/meetingPlans';

export const dynamic = 'force-dynamic';

// Save my availability for this plan (and only this plan). Answers hidden by the current grid (a removed day or hour) are kept.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePlans();
  if ('error' in auth) return auth.error;
  const { data } = await auth.svc.from('meeting_plans').select('*').eq('id', (await params).id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
  const plan = data as PlanRow;
  const { people } = await planPeople(auth.svc, plan);
  if (!people.some((p) => p.id === auth.user.id)) return NextResponse.json({ error: 'This plan isn’t asking you.' }, { status: 403 });
  if (plan.status !== 'open') return NextResponse.json({ error: 'A time was already picked, so answers are locked.' }, { status: 409 });
  const b = await request.json().catch(() => ({}));
  const days = planDayKeys(plan, pacificDayKey());
  const starts = slotStarts(plan.window_start, plan.window_end);
  // Whatever is already on their Triton Gaming calendar can't be marked available.
  const busy = await busyBlocksFor(auth.svc, auth.user, auth.roles, plan, days);
  const mine = withoutBusy(cleanSlots(b.slots, days, starts), busy, starts);
  const { data: existing } = await auth.svc.from('meeting_plan_responses').select('slots').eq('plan_id', plan.id).eq('user_id', auth.user.id).maybeSingle();
  const old = (existing?.slots ?? {}) as PlanSlots;
  const inGrid = new Set(starts);
  // Keep what the grid doesn't show right now (other days, hours outside the window); replace what it does.
  const merged: PlanSlots = {};
  for (const [day, row] of Object.entries(old)) {
    const keep = days.includes(day) ? Object.fromEntries(Object.entries(row).filter(([t]) => !inGrid.has(t))) : row;
    if (Object.keys(keep).length) merged[day] = keep as PlanSlots[string];
  }
  for (const [day, row] of Object.entries(mine)) merged[day] = { ...(merged[day] ?? {}), ...row };
  const { error } = await auth.svc.from('meeting_plan_responses').upsert({ plan_id: plan.id, user_id: auth.user.id, slots: merged, busy, updated_at: new Date().toISOString() }, { onConflict: 'plan_id,user_id' });
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
