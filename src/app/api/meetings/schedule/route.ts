import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { pacificDayKey } from '@/lib/checkinDays';
import { authorizeMeetings, buildSchedule, notifyMeetingInvites, occurrenceTimes, validateDocUrl } from '@/lib/meetings';
import { MAX_QUESTION_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/meetingFun';
import { formatPacificDateTime } from '@/lib/timezone';
import { validateAudienceInput } from '@/lib/meetingAudience';

export const dynamic = 'force-dynamic';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Exec's list: the next two weeks, the repeating series, and recent past meetings.
export async function GET() {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  return NextResponse.json(await buildSchedule(auth.svc, undefined, auth.manageAll ? undefined : auth.user.id));
}

// Schedule a one-off meeting ({repeat:'once', date}) or a weekly one ({repeat:'weekly', weekday}).
export async function POST(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const title = String(b.title ?? '').trim().slice(0, 60);
  const location = String(b.location ?? '').trim().slice(0, 80) || null;
  const start = String(b.start ?? ''), end = String(b.end ?? '');
  const doc = validateDocUrl(b.doc_url);
  if (!doc.ok) return NextResponse.json({ error: 'The doc link must start with https:// (or be a path on this site).' }, { status: 400 });
  const aud = validateAudienceInput(b);
  const description = String(b.description ?? '').trim().slice(0, MAX_DESCRIPTION_LENGTH) || null;
  if (!aud.ok) return NextResponse.json({ error: 'Pick who the meeting is for.' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Give the meeting a name.' }, { status: 400 });
  if (!TIME.test(start) || !TIME.test(end) || end <= start) return NextResponse.json({ error: 'Pick a start time and a later end time.' }, { status: 400 });

  if (b.repeat === 'weekly') {
    const weekday = Number(b.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return NextResponse.json({ error: 'Pick a day of the week.' }, { status: 400 });
    const endsOn = b.ends_on ? String(b.ends_on) : null;
    if (endsOn && (!DATE.test(endsOn) || endsOn < pacificDayKey())) return NextResponse.json({ error: 'The last day can’t be in the past.' }, { status: 400 });
    const { data, error } = await auth.svc.from('meeting_series').insert({ ends_on: endsOn, title, weekday, start_time: start, end_time: end, location, doc_url: doc.value, audience: aud.audience, invitees: aud.invitees, group_ids: aud.group_ids, description, created_by: auth.user.id }).select('id').single();
    if (error) return NextResponse.json({ error: 'Failed to schedule.' }, { status: 500 });
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'meeting series', entityId: data.id, summary: `Scheduled repeating meeting "${title}"`, details: { weekday, start, end } });
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday];
    await notifyMeetingInvites(auth.svc, { title, when: `Every ${day}, ${start}–${end}${location ? ` · ${location}` : ''}` }, { audience: aud.audience, invitees: aud.invitees, group_ids: aud.group_ids }, { hostId: auth.user.id });
    return NextResponse.json({ id: data.id }, { status: 201 });
  }

  const date = String(b.date ?? '');
  if (!DATE.test(date) || date < pacificDayKey()) return NextResponse.json({ error: 'Pick a date that hasn’t passed.' }, { status: 400 });
  const { starts, ends } = occurrenceTimes(date, start, end);
  const { data, error } = await auth.svc.from('meetings').insert({ title, meeting_date: date, starts_at: starts.toISOString(), ends_at: ends.toISOString(), location, doc_url: doc.value, audience: aud.audience, invitees: aud.invitees, group_ids: aud.group_ids, description, created_by: auth.user.id, question: String(b.question ?? '').trim().slice(0, MAX_QUESTION_LENGTH) || null }).select('id').single();
  if (error) return NextResponse.json({ error: 'Failed to schedule.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'meeting', entityId: data.id, summary: `Scheduled "${title}" for ${date}` });
  await notifyMeetingInvites(auth.svc, { title, when: `${formatPacificDateTime(starts, { weekday: true })}${location ? ` · ${location}` : ''}` }, { audience: aud.audience, invitees: aud.invitees, group_ids: aud.group_ids }, { hostId: auth.user.id });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
