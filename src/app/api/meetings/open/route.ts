import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { pacificDayKey } from '@/lib/checkinDays';
import { authorizeMeetings, occurrenceTimes, weekdayOfKey, type MeetingRow } from '@/lib/meetings';

// Exec starts (or re-opens) check-in for one specific meeting: either an existing meeting
// ({meeting_id}) or the occurrence of a repeating series on a date ({series_id, date}).
// Only on the day of the meeting. If its scheduled end has already passed, the window is
// extended so check-in is actually usable.
export async function POST(request: Request) {
  const auth = await authorizeMeetings('manage_meetings');
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
    if (b.date !== today) return NextResponse.json({ error: 'You can start check-in on the day of the meeting.' }, { status: 409 });
    const { starts, ends } = occurrenceTimes(b.date, s.start_time, s.end_time);
    await auth.svc.from('meetings').upsert(
      { series_id: s.id, title: s.title, meeting_date: b.date, starts_at: starts.toISOString(), ends_at: ends.toISOString(), location: s.location, doc_url: s.doc_url, audience: s.audience, invitees: s.invitees },
      { onConflict: 'series_id,meeting_date', ignoreDuplicates: true });
    const { data } = await auth.svc.from('meetings').select('*').eq('series_id', s.id).eq('meeting_date', b.date).maybeSingle();
    meeting = data as MeetingRow | null;
  }
  if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  if (meeting.cancelled) return NextResponse.json({ error: 'This meeting was skipped. Restore it first.' }, { status: 409 });
  if (meeting.meeting_date !== today) return NextResponse.json({ error: 'You can start check-in on the day of the meeting.' }, { status: 409 });

  const newEnd = new Date(Math.max(new Date(meeting.ends_at).getTime(), Date.now() + 30 * 60_000));
  const { error } = await auth.svc.from('meetings')
    .update({ opened_at: meeting.opened_at ?? new Date().toISOString(), closed_at: null, ends_at: newEnd.toISOString(), opened_by: auth.user.id })
    .eq('id', meeting.id);
  if (error) return NextResponse.json({ error: 'Failed to open check-in.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'open', entityType: 'meeting', entityId: meeting.id, summary: `Opened check-in for "${meeting.title}" (${meeting.meeting_date})` });
  return NextResponse.json({ id: meeting.id });
}
