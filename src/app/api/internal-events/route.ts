import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { pacificDayKey } from '@/lib/checkinDays';
import { notifyMeetingInvites, occurrenceTimes } from '@/lib/meetings';
import { MAX_DESCRIPTION_LENGTH } from '@/lib/meetingFun';
import { validateAudienceInput } from '@/lib/meetingAudience';
import { formatPacificDateTime } from '@/lib/timezone';
import { authorizeInternalEvents, listInternalEvents } from '@/lib/internalEvents';

export const dynamic = 'force-dynamic';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET: internal events meant for me. GET ?scope=manage: the ones I can edit (hosts only).
export async function GET(request: Request) {
  const manage = new URL(request.url).searchParams.get('scope') === 'manage';
  const auth = await authorizeInternalEvents(manage ? 'host_internal_events' : 'view_internal_events');
  if (auth.error) return auth.error;
  return NextResponse.json({ events: await listInternalEvents(auth.svc, { id: auth.user.id, roles: auth.roles }, auth.manageAll, manage ? 'manage' : 'invited') });
}

export async function POST(request: Request) {
  const auth = await authorizeInternalEvents('host_internal_events');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const title = String(b.title ?? '').trim().slice(0, 60);
  const location = String(b.location ?? '').trim().slice(0, 80) || null;
  const description = String(b.description ?? '').trim().slice(0, MAX_DESCRIPTION_LENGTH) || null;
  const date = String(b.date ?? ''), start = String(b.start ?? ''), end = String(b.end ?? '');
  const aud = validateAudienceInput(b);
  if (!title) return NextResponse.json({ error: 'Give the event a name.' }, { status: 400 });
  if (!aud.ok) return NextResponse.json({ error: 'Pick who it’s for.' }, { status: 400 });
  if (!DATE.test(date) || date < pacificDayKey()) return NextResponse.json({ error: 'Pick a date that hasn’t passed.' }, { status: 400 });
  if (!TIME.test(start) || !TIME.test(end) || end <= start) return NextResponse.json({ error: 'Pick a start time and a later end time.' }, { status: 400 });
  const { starts, ends } = occurrenceTimes(date, start, end);
  const { data, error } = await auth.svc.from('internal_events').insert({ title, event_date: date, starts_at: starts.toISOString(), ends_at: ends.toISOString(), location, description, audience: aud.audience, invitees: aud.invitees ?? [], group_ids: aud.group_ids ?? [], created_by: auth.user.id }).select('id').single();
  if (error || !data) return NextResponse.json({ error: 'Failed to create the event.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'internal event', entityId: data.id, summary: `Planned internal event "${title}" for ${date}` });
  await notifyMeetingInvites(auth.svc, { title, when: `${formatPacificDateTime(starts, { weekday: true })}${location ? ` · ${location}` : ''}`, href: '/portal/internal-events' }, { audience: aud.audience, invitees: aud.invitees, group_ids: aud.group_ids }, { hostId: auth.user.id });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
