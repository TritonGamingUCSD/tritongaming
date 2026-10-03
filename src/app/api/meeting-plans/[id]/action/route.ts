import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { answeredUserIds, authorizePlans, decidePlan, notifyPlanAsk, planPeople, reopenPlan, type PlanRow } from '@/lib/meetingPlanServer';

export const dynamic = 'force-dynamic';

// Host actions on a plan: { action: 'nudge' | 'decide' | 'reopen', day?, weekday?, start? }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePlans();
  if ('error' in auth) return auth.error;
  const { data } = await auth.svc.from('meeting_plans').select('*').eq('id', (await params).id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
  const plan = data as PlanRow;
  if (!auth.canHost || (plan.created_by !== auth.user.id && !auth.manageAll)) return NextResponse.json({ error: 'Only the host, exec and admins can do that.' }, { status: 403 });
  const b = await request.json().catch(() => ({}));

  if (b.action === 'nudge') {
    if (plan.status !== 'open') return NextResponse.json({ error: 'A time was already picked.' }, { status: 409 });
    // A manual reminder goes to everyone who hasn't answered, so it can only be sent once every 12 hours.
    const NUDGE_GAP_MS = 12 * 3600_000;
    if (plan.nudged_at && Date.now() - new Date(plan.nudged_at).getTime() < NUDGE_GAP_MS) {
      const at = new Date(new Date(plan.nudged_at).getTime() + NUDGE_GAP_MS).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });
      return NextResponse.json({ error: `People were already reminded recently. You can remind them again after ${at}.` }, { status: 429 });
    }
    const { people } = await planPeople(auth.svc, plan);
    const answered = await answeredUserIds(auth.svc, plan);
    const waiting = people.filter((p) => !answered.has(p.id) && p.id !== plan.created_by);
    const sent = await notifyPlanAsk(auth.svc, plan, { kind: 'nudge', skip: answered });
    if (sent > 0) await auth.svc.from('meeting_plans').update({ nudged_at: new Date().toISOString() }).eq('id', plan.id);
    return NextResponse.json({ ok: true, reminded: sent, waiting: waiting.length });
  }
  if (b.action === 'decide') {
    const result = await decidePlan(auth.svc, plan, { day: b.day ? String(b.day) : undefined, weekday: b.weekday !== undefined ? Number(b.weekday) : undefined, start: String(b.start ?? '') }, auth.user.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'schedule', entityType: 'meeting plan', entityId: plan.id, summary: `Picked a time for "${plan.title}"`, details: { absent: result.absent.length } });
    return NextResponse.json(result);
  }
  if (b.action === 'reopen') {
    const result = await reopenPlan(auth.svc, plan);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'reopen', entityType: 'meeting plan', entityId: plan.id, summary: `Reopened planning for "${plan.title}"` });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
