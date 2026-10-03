import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { pacificDayKey } from '@/lib/checkinDays';
import { isExpected } from '@/lib/meetingAudience';
import { attachExtras, authorizeMeetings, checkInOpensAt, ensureOccurrence, weekdayOfKey, type MeetingRow, type SeriesRow, canManageMeeting, notYourMeeting } from '@/lib/meetings';

// Exec starts (or re-opens) check-in for one specific meeting: either an existing meeting
// ({meeting_id}) or the occurrence of a repeating series on a date ({series_id, date}).
// Only on the day of the meeting. If its scheduled end has already passed, the window is
// extended so check-in is actually usable.
export async function POST(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const today = pacificDayKey();

  let meeting: MeetingRow | null = null;
  if (b.meeting_id) {
    const { data } = await auth.svc.from('meetings').select('*').eq('id', b.meeting_id).maybeSingle();
    meeting = data as MeetingRow | null;
  } else if (b.series_id && /^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) {
    const { data: s } = await auth.svc.from('meeting_series').select('*').eq('id', b.series_id).maybeSingle();
    if (!s || !s.active || weekdayOfKey(b.date) !== s.weekday) return NextResponse.json({ error: 'That meeting isn’t scheduled.' }, { status: 404 });
    if (!canManageMeeting(auth, s.created_by)) return notYourMeeting();
    if (b.date !== today) return NextResponse.json({ error: 'You can start check-in on the day of the meeting.' }, { status: 409 });
    meeting = await ensureOccurrence(auth.svc, s as SeriesRow, b.date);
  }
  if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  if (!canManageMeeting(auth, meeting.created_by)) return notYourMeeting();
  if (meeting.cancelled) return NextResponse.json({ error: 'This meeting was skipped. Restore it first.' }, { status: 409 });
  if (meeting.meeting_date !== today) return NextResponse.json({ error: 'You can start check-in on the day of the meeting.' }, { status: 409 });

  const newEnd = new Date(Math.max(new Date(meeting.ends_at).getTime(), Date.now() + 30 * 60_000));
  const { error } = await auth.svc.from('meetings')
    .update({ opened_at: meeting.opened_at ?? new Date().toISOString(), closed_at: null, ends_at: newEnd.toISOString(), opened_by: auth.user.id })
    .eq('id', meeting.id);
  if (error) return NextResponse.json({ error: 'Failed to open check-in.' }, { status: 500 });
  // Whoever opens check-in is in the room: if the meeting is for them AND we're inside the same window
  // members can check in (10 minutes before the start until the end), check them in too. Opening it
  // early from a desk doesn't count. Never overwrites an existing check-in.
  const [withExtra] = await attachExtras(auth.svc, [meeting]);
  if (Date.now() >= checkInOpensAt(meeting) && isExpected(withExtra, auth.user.id, auth.roles)) {
    await auth.svc.from('meeting_attendance').upsert({ meeting_id: meeting.id, user_id: auth.user.id, method: 'host' }, { onConflict: 'meeting_id,user_id', ignoreDuplicates: true });
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'open', entityType: 'meeting', entityId: meeting.id, summary: `Opened check-in for "${meeting.title}" (${meeting.meeting_date})` });
  return NextResponse.json({ id: meeting.id });
}
