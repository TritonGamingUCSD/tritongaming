import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { validateAudienceInput } from '@/lib/meetings/meetingAudience';
import { authorizePlans, loadPlanViews, notifyPlanAsk, readPlanFields, type PlanRow } from '@/lib/meetings/meetingPlanServer';

export const dynamic = 'force-dynamic';

// The plans this person can see (asked to answer, or they host it).
export async function GET() {
  const auth = await authorizePlans();
  if ('error' in auth) return auth.error;
  return NextResponse.json({ plans: await loadPlanViews(auth), canHost: auth.canHost });
}

export async function POST(request: Request) {
  const auth = await authorizePlans();
  if ('error' in auth) return auth.error;
  if (!auth.canHost) return NextResponse.json({ error: 'Only leads, exec and admins can plan meetings.' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const kind = b.kind === 'weekly' ? 'weekly' : 'once';
  const aud = validateAudienceInput(b);
  if (!aud.ok) return NextResponse.json({ error: 'Pick who the meeting is for.' }, { status: 400 });
  const f = readPlanFields(b, kind);
  if (!f.ok) return NextResponse.json({ error: f.error }, { status: 400 });
  const { data, error } = await auth.svc.from('meeting_plans').insert({ ...f.v, kind, audience: aud.audience, invitees: aud.invitees, group_ids: aud.group_ids, created_by: auth.user.id }).select('*').single();
  if (error || !data) return NextResponse.json({ error: 'Failed to create the plan.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'meeting plan', entityId: data.id as string, summary: `Started planning "${data.title}"` });
  await notifyPlanAsk(auth.svc, data as PlanRow, { kind: 'new' });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
