import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { pacificDayKey } from '@/lib/checkinDays';
import { notifyMeetingInvites, occurrenceTimes } from '@/lib/meetings';
import { MAX_DESCRIPTION_LENGTH } from '@/lib/meetingFun';
import { validateAudienceInput } from '@/lib/meetingAudience';
import { formatPacificDateTime } from '@/lib/timezone';
import { authorizeInternalEvents, canManageInternalEvent, notYourInternalEvent, type InternalEventRow } from '@/lib/internalEvents';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function load(auth: Exclude<Awaited<ReturnType<typeof authorizeInternalEvents>>, { error: NextResponse }>, id: string) {
  const { data } = await auth.svc.from('internal_events').select('*').eq('id', id).maybeSingle();
  return data as InternalEventRow | null;
}

// Edit an internal event (name, date, times, room, description, who it's for).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeInternalEvents('host_internal_events');
  if (auth.error) return auth.error;
  const { id } = await params;
  const cur = await load(auth, id);
  if (!cur) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  if (!canManageInternalEvent(auth, cur.created_by)) return notYourInternalEvent();
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if ('title' in b) { const t = String(b.title ?? '').trim().slice(0, 60); if (!t) return NextResponse.json({ error: 'Give the event a name.' }, { status: 400 }); patch.title = t; }
  if ('location' in b) patch.location = String(b.location ?? '').trim().slice(0, 80) || null;
  if ('description' in b) patch.description = String(b.description ?? '').trim().slice(0, MAX_DESCRIPTION_LENGTH) || null;
  if ('audience' in b || 'invitees' in b || 'group_ids' in b) {
    const aud = validateAudienceInput(b);
    if (!aud.ok) return NextResponse.json({ error: 'Pick who it’s for.' }, { status: 400 });
    patch.audience = aud.audience; patch.invitees = aud.invitees ?? []; patch.group_ids = aud.group_ids ?? [];
  }
  if ('date' in b || 'start' in b || 'end' in b) {
    const date = String(b.date ?? cur.event_date);
    const pt = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    const start = String(b.start ?? pt(cur.starts_at)), end = String(b.end ?? pt(cur.ends_at));
    if (!DATE.test(date) || (date !== cur.event_date && date < pacificDayKey())) return NextResponse.json({ error: 'Pick a date that hasn’t passed.' }, { status: 400 });
    if (!TIME.test(start) || !TIME.test(end) || end <= start) return NextResponse.json({ error: 'Pick a start time and a later end time.' }, { status: 400 });
    const { starts, ends } = occurrenceTimes(date, start, end);
    patch.event_date = date; patch.starts_at = starts.toISOString(); patch.ends_at = ends.toISOString();
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { error } = await auth.svc.from('internal_events').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'internal event', entityId: id, summary: `Updated internal event "${(patch.title as string) ?? cur.title}"` });
  if ('audience' in patch) {
    const when = formatPacificDateTime((patch.starts_at as string) ?? cur.starts_at, { weekday: true });
    await notifyMeetingInvites(auth.svc, { title: (patch.title as string) ?? cur.title, when, href: '/portal/internal-events' },
      { audience: patch.audience as string[] | null, invitees: patch.invitees as string[] | null, group_ids: patch.group_ids as string[] | null },
      { before: cur, hostId: auth.user.id });
  }
  return NextResponse.json({ ok: true });
}

// Cancel (removes it from everyone's list) — the same as deleting; RSVPs go with it.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeInternalEvents('host_internal_events');
  if (auth.error) return auth.error;
  const { id } = await params;
  const cur = await load(auth, id);
  if (!cur) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  if (!canManageInternalEvent(auth, cur.created_by)) return notYourInternalEvent();
  const { error } = await auth.svc.from('internal_events').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'internal event', entityId: id, summary: `Deleted internal event "${cur.title}"` });
  return NextResponse.json({ ok: true });
}
