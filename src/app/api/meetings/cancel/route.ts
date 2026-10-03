import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, ensureOccurrence, type MeetingRow, type SeriesRow, canManageMeeting, notYourMeeting } from '@/lib/meetings';

// Skip one meeting (a holiday week) or bring it back. A one-off meeting is simply removed;
// one that belongs to a repeating series stays in the list as "skipped" so it can be restored.
// Meetings that already have check-ins can't be cancelled.
export async function POST(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const undo = b.undo === true;

  let meeting: MeetingRow | null = null;
  if (b.meeting_id) {
    const { data } = await auth.svc.from('meetings').select('*').eq('id', b.meeting_id).maybeSingle();
    meeting = data as MeetingRow | null;
  } else if (b.series_id && /^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) {
    const { data: s } = await auth.svc.from('meeting_series').select('*').eq('id', b.series_id).maybeSingle();
    if (!s) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    if (!canManageMeeting(auth, s.created_by)) return notYourMeeting();
    meeting = await ensureOccurrence(auth.svc, s as SeriesRow, b.date);
  }
  if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  if (!canManageMeeting(auth, meeting.created_by)) return notYourMeeting();

  const { count } = await auth.svc.from('meeting_attendance').select('user_id', { count: 'exact', head: true }).eq('meeting_id', meeting.id);
  if (!undo && (count ?? 0) > 0) return NextResponse.json({ error: 'People already checked in to this one, so it can’t be skipped.' }, { status: 409 });

  if (!undo && !meeting.series_id) {
    await auth.svc.from('meetings').delete().eq('id', meeting.id);
  } else {
    await auth.svc.from('meetings').update({ cancelled: !undo, ...(undo ? {} : { opened_at: null, closed_at: null }) }).eq('id', meeting.id);
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: undo ? 'restore' : 'cancel', entityType: 'meeting', entityId: meeting.id, summary: `${undo ? 'Restored' : 'Skipped'} "${meeting.title}" on ${meeting.meeting_date}` });
  return NextResponse.json({ ok: true });
}
