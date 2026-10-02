import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, occurrenceTimes, type MeetingRow, canManageMeeting, notYourMeeting } from '@/lib/meetings';

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
    const { starts, ends } = occurrenceTimes(b.date, s.start_time, s.end_time);
    await auth.svc.from('meetings').upsert(
      { series_id: s.id, title: s.title, meeting_date: b.date, starts_at: starts.toISOString(), ends_at: ends.toISOString(), location: s.location, doc_url: s.doc_url, audience: s.audience, invitees: s.invitees, group_ids: s.group_ids, description: s.description, created_by: s.created_by },
      { onConflict: 'series_id,meeting_date', ignoreDuplicates: true });
    const { data } = await auth.svc.from('meetings').select('*').eq('series_id', s.id).eq('meeting_date', b.date).maybeSingle();
    meeting = data as MeetingRow | null;
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
