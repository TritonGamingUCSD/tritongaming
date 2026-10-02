import { NextResponse } from 'next/server';
import { isExpected } from '@/lib/meetingAudience';
import { loadGroups, withExtras } from '@/lib/meetings';
import { authorizeInternalEvents, RSVP_STATUSES, type RsvpStatus, type InternalEventRow } from '@/lib/internalEvents';

// Say whether you're coming ({status: 'going' | 'maybe' | 'not_going'}) or clear your answer ({status: null}).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeInternalEvents('view_internal_events');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data } = await auth.svc.from('internal_events').select('*').eq('id', id).maybeSingle();
  const s = data as InternalEventRow | null;
  if (!s || s.cancelled) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  const [x] = withExtras([{ invitees: s.invitees, group_ids: s.group_ids }], await loadGroups(auth.svc));
  if (s.created_by !== auth.user.id && !isExpected({ audience: s.audience, extra_ids: x.extra_ids }, auth.user.id, auth.roles)) {
    return NextResponse.json({ error: 'That event isn’t for you.' }, { status: 403 });
  }
  const b = await request.json().catch(() => ({}));
  if (b.status === null) {
    await auth.svc.from('internal_event_rsvps').delete().eq('event_id', id).eq('user_id', auth.user.id);
    return NextResponse.json({ ok: true });
  }
  if (!RSVP_STATUSES.includes(b.status as RsvpStatus)) return NextResponse.json({ error: 'Pick going, maybe or can’t go.' }, { status: 400 });
  const { error } = await auth.svc.from('internal_event_rsvps').upsert({ event_id: id, user_id: auth.user.id, status: b.status, updated_at: new Date().toISOString() }, { onConflict: 'event_id,user_id' });
  if (error) return NextResponse.json({ error: 'Couldn’t save that. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
