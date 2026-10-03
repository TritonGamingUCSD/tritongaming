import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, ensureOccurrence, isMeetingOpen, isMeetingOver, occurrenceTimes, validateDocUrl, type MeetingRow, type SeriesRow, canManageMeeting, notYourMeeting, notifyMeetingInvites } from '@/lib/meetings';
import { MAX_QUESTION_LENGTH, MAX_DESCRIPTION_LENGTH, asQuestionType, cleanOptions } from '@/lib/meetingFun';
import { formatPacificDateTime } from '@/lib/timezone';
import { validateAudienceInput } from '@/lib/meetingAudience';

// Set the doc link (and room) for ONE meeting — an existing one ({meeting_id}) or the next
// occurrence of a repeating series ({series_id, date}), which is created on the spot.
export async function POST(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, string | string[] | null> = {};
  if ('doc_url' in b) {
    const doc = validateDocUrl(b.doc_url);
    if (!doc.ok) return NextResponse.json({ error: 'The doc link must start with https:// (or be a path on this site).' }, { status: 400 });
    patch.doc_url = doc.value;
  }
  if ('location' in b) patch.location = String(b.location ?? '').trim().slice(0, 80) || null;
  if ('description' in b) patch.description = String(b.description ?? '').trim().slice(0, MAX_DESCRIPTION_LENGTH) || null;
  if ('question' in b) patch.question = String(b.question ?? '').trim().slice(0, MAX_QUESTION_LENGTH) || null;
  if ('question_type' in b || 'question_options' in b) {
    const type = asQuestionType(b.question_type);
    const options = type === 'poll' ? cleanOptions(b.question_options) : null;
    if (type === 'poll' && !options) return NextResponse.json({ error: 'A poll needs 2 to 4 different options.' }, { status: 400 });
    patch.question_type = type;
    patch.question_options = options;
  }
  if ('audience' in b || 'invitees' in b || 'group_ids' in b) {
    const aud = validateAudienceInput(b);
    if (!aud.ok) return NextResponse.json({ error: 'Pick who the meeting is for.' }, { status: 400 });
    patch.audience = aud.audience;
    patch.invitees = aud.invitees;
    patch.group_ids = aud.group_ids;
  }
  const wantsFields = ['title', 'start', 'end'].some((k) => k in b);
  if (Object.keys(patch).length === 0 && !wantsFields) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  let id: string | null = b.meeting_id ?? null;
  if (!id && b.series_id && /^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) {
    const { data: s } = await auth.svc.from('meeting_series').select('*').eq('id', b.series_id).maybeSingle();
    if (!s) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    if (!canManageMeeting(auth, s.created_by)) return notYourMeeting();
    id = (await ensureOccurrence(auth.svc, s as SeriesRow, b.date))?.id ?? null;
  }
  if (!id) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  const { data: own } = await auth.svc.from('meetings').select('*').eq('id', id).maybeSingle();
  const row0 = own as MeetingRow | null;
  if (!row0) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  if (!canManageMeeting(auth, row0.created_by)) return notYourMeeting();
  // Once a meeting is over, all of its info (name, time, room, description, doc link, question, who it was for) is a record and can't change.
  if (isMeetingOver(row0)) {
    return NextResponse.json({ error: 'This meeting has ended, so its info is locked.' }, { status: 409 });
  }
  // Name and time can be changed any time, even after check-in started. (Not the date: to move a
  // meeting to another day, make a new one. A repeating meeting's weeks keep the shared name.)
  if ('title' in b) {
    const t = String(b.title ?? '').trim().slice(0, 60);
    if (!t) return NextResponse.json({ error: 'Give the meeting a name.' }, { status: 400 });
    if (row0.series_id && t !== row0.title) return NextResponse.json({ error: 'A repeating meeting keeps its name every week.' }, { status: 400 });
    patch.title = t;
  }
  if ('start' in b || 'end' in b) {
    const re = /^([01]\d|2[0-3]):[0-5]\d$/;
    const st = String(b.start ?? ''), en = String(b.end ?? '');
    if (!re.test(st) || !re.test(en) || en <= st) return NextResponse.json({ error: 'Pick a start time and a later end time.' }, { status: 400 });
    const { starts, ends } = occurrenceTimes(row0.meeting_date, st, en);
    patch.starts_at = starts.toISOString();
    patch.ends_at = ends.toISOString();
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  // Once check-in has been opened (a code is live), the question is locked so people who already
  // answered aren't answering something different.
  if ('question' in patch || 'question_type' in patch) {
    const { data: cur } = await auth.svc.from('meetings').select('*').eq('id', id).maybeSingle();
    const row = cur as MeetingRow | null;
    if (row && isMeetingOpen(row) && ((row.question ?? null) !== patch.question || ('question_type' in patch && (row.question_type ?? 'text') !== patch.question_type) || ('question_options' in patch && JSON.stringify(row.question_options ?? null) !== JSON.stringify(patch.question_options)))) {
      return NextResponse.json({ error: 'The question can’t be changed while check-in is open. Close check-in first.' }, { status: 409 });
    }
  }
  const { data: m, error } = await auth.svc.from('meetings').update(patch).eq('id', id).select('title, meeting_date').maybeSingle();
  if (error || !m) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  if ('audience' in patch || 'invitees' in patch || 'group_ids' in patch) {
    const { data: fresh } = await auth.svc.from('meetings').select('starts_at, location').eq('id', id).maybeSingle();
    const when = fresh ? `${formatPacificDateTime(fresh.starts_at, { weekday: true })}${fresh.location ? ` · ${fresh.location}` : ''}` : m.meeting_date;
    await notifyMeetingInvites(auth.svc, { title: m.title, when }, { audience: (patch.audience ?? row0.audience) as string[] | null, invitees: (patch.invitees ?? row0.invitees) as string[] | null, group_ids: (patch.group_ids ?? row0.group_ids) as string[] | null }, { before: row0, hostId: auth.user.id });
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'meeting', entityId: id, summary: `Updated ${Object.keys(patch).map((k) => k.replace('_url', ' link')).join(' and ')} for "${m.title}" (${m.meeting_date})` });
  return NextResponse.json({ id, ...patch });
}
