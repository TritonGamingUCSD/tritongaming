import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, occurrenceTimes, validateDocUrl } from '@/lib/meetings';
import { MAX_QUESTION_LENGTH } from '@/lib/meetingFun';
import { validateAudienceInput } from '@/lib/meetingAudience';

// Set the doc link (and room) for ONE meeting — an existing one ({meeting_id}) or the next
// occurrence of a repeating series ({series_id, date}), which is created on the spot.
export async function POST(request: Request) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, string | string[] | null> = {};
  if ('doc_url' in b) {
    const doc = validateDocUrl(b.doc_url);
    if (!doc.ok) return NextResponse.json({ error: 'The doc link must start with https:// (or be a path on this site).' }, { status: 400 });
    patch.doc_url = doc.value;
  }
  if ('location' in b) patch.location = String(b.location ?? '').trim().slice(0, 80) || null;
  if ('question' in b) patch.question = String(b.question ?? '').trim().slice(0, MAX_QUESTION_LENGTH) || null;
  if ('audience' in b || 'invitees' in b) {
    const aud = validateAudienceInput(b);
    if (!aud.ok) return NextResponse.json({ error: 'Pick who the meeting is for.' }, { status: 400 });
    patch.audience = aud.audience;
    patch.invitees = aud.invitees;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  let id: string | null = b.meeting_id ?? null;
  if (!id && b.series_id && /^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) {
    const { data: s } = await auth.svc.from('meeting_series').select('*').eq('id', b.series_id).maybeSingle();
    if (!s) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    const { starts, ends } = occurrenceTimes(b.date, s.start_time, s.end_time);
    await auth.svc.from('meetings').upsert(
      { series_id: s.id, title: s.title, meeting_date: b.date, starts_at: starts.toISOString(), ends_at: ends.toISOString(), location: s.location, doc_url: s.doc_url, audience: s.audience, invitees: s.invitees },
      { onConflict: 'series_id,meeting_date', ignoreDuplicates: true });
    const { data } = await auth.svc.from('meetings').select('id').eq('series_id', s.id).eq('meeting_date', b.date).maybeSingle();
    id = data?.id ?? null;
  }
  if (!id) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  const { data: m, error } = await auth.svc.from('meetings').update(patch).eq('id', id).select('title, meeting_date').maybeSingle();
  if (error || !m) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'meeting', entityId: id, summary: `Updated ${Object.keys(patch).map((k) => k.replace('_url', ' link')).join(' and ')} for "${m.title}" (${m.meeting_date})` });
  return NextResponse.json({ id, ...patch });
}
