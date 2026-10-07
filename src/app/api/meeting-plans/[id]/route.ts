import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { validateAudienceInput } from '@/lib/meetings/meetingAudience';
import { authorizePlans, notifyPlanAsk, planPeople, readPlanFields, type PlanRow } from '@/lib/meetings/meetingPlanServer';

export const dynamic = 'force-dynamic';

async function loadOwn(auth: Exclude<Awaited<ReturnType<typeof authorizePlans>>, { error: NextResponse }>, id: string): Promise<{ plan: PlanRow } | { error: NextResponse }> {
  const { data } = await auth.svc.from('meeting_plans').select('*').eq('id', id).maybeSingle();
  if (!data) return { error: NextResponse.json({ error: 'Plan not found.' }, { status: 404 }) };
  const plan = data as PlanRow;
  if (!auth.canHost || (plan.created_by !== auth.user.id && !auth.manageAll)) return { error: NextResponse.json({ error: 'Only the host, exec and admins can change this plan.' }, { status: 403 }) };
  return { plan };
}

// Edit the plan while it is open: name, length, hours, dates, who it is for. Answers on days or hours that are taken out are kept
// (hidden) and come back if the day returns.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePlans();
  if ('error' in auth) return auth.error;
  const own = await loadOwn(auth, (await params).id);
  if ('error' in own) return own.error;
  const { plan } = own;
  if (plan.status !== 'open') return NextResponse.json({ error: 'A time was already picked. Reopen planning to change it.' }, { status: 409 });
  const b = await request.json().catch(() => ({}));
  const f = readPlanFields({ ...plan, ...b }, plan.kind);
  if (!f.ok) return NextResponse.json({ error: f.error }, { status: 400 });
  const patch: Record<string, unknown> = { ...f.v };
  let audChanged = false;
  if ('audience' in b || 'invitees' in b || 'group_ids' in b) {
    const aud = validateAudienceInput({ audience: b.audience ?? plan.audience, invitees: b.invitees ?? plan.invitees, group_ids: b.group_ids ?? plan.group_ids });
    if (!aud.ok) return NextResponse.json({ error: 'Pick who the meeting is for.' }, { status: 400 });
    Object.assign(patch, { audience: aud.audience, invitees: aud.invitees, group_ids: aud.group_ids });
    audChanged = true;
  }
  const { data: updated, error } = await auth.svc.from('meeting_plans').update(patch).eq('id', plan.id).select('*').single();
  if (error || !updated) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  const next = updated as PlanRow;
  const timeChanged = ['range_start', 'range_end', 'window_start', 'window_end', 'duration_min'].some((k) => String(plan[k as keyof PlanRow] ?? '').slice(0, 10) !== String(next[k as keyof PlanRow] ?? '').slice(0, 10));
  if (audChanged) {
    // People newly asked get the invitation; everyone else only hears about changed dates.
    const [before, after] = await Promise.all([planPeople(auth.svc, plan), planPeople(auth.svc, next)]);
    const old = new Set(before.people.map((p) => p.id));
    const fresh = after.people.filter((p) => !old.has(p.id)).map((p) => p.id);
    if (fresh.length) await notifyPlanAsk(auth.svc, next, { kind: 'new', onlyUsers: fresh });
    if (timeChanged) await notifyPlanAsk(auth.svc, next, { kind: 'dates', skip: new Set(fresh) });
  } else if (timeChanged) {
    await notifyPlanAsk(auth.svc, next, { kind: 'dates' });
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'meeting plan', entityId: plan.id, summary: `Edited the plan "${next.title}"` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePlans();
  if ('error' in auth) return auth.error;
  const own = await loadOwn(auth, (await params).id);
  if ('error' in own) return own.error;
  if (own.plan.status !== 'open') return NextResponse.json({ error: 'This plan already became a meeting. Reopen planning first.' }, { status: 409 });
  await auth.svc.from('meeting_plans').delete().eq('id', own.plan.id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'meeting plan', entityId: own.plan.id, summary: `Deleted the plan "${own.plan.title}"` });
  return NextResponse.json({ ok: true });
}
