import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, getExpectedPeople, resolveOccurrence } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

// Advance absences: a host records that someone can't make a meeting (with a reason) before it starts, for a meeting
// or for one occurrence of a repeating meeting. Works for meetings that haven't been opened yet; the occurrence is created on the
// first absence. {meeting_id} or {series_id, date}.
//   GET    ?meeting_id=… | ?series_id=…&date=…   who the meeting is for + who is already marked absent
//   POST   { …, user_id, reason?, excused? }       mark someone absent
//   DELETE { …, user_id }                          take the mark off
export async function GET(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const q = new URL(request.url).searchParams;
  const found = await resolveOccurrence(auth, { meeting_id: q.get('meeting_id'), series_id: q.get('series_id'), date: q.get('date') }, false);
  if ('error' in found) return found.error;
  const src = found.meeting ?? found.series;
  if (!src) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  const expected = await getExpectedPeople(auth.svc, { audience: src.audience, invitees: src.invitees, group_ids: src.group_ids });
  const { data: abs } = found.meeting ? await auth.svc.from('meeting_absences').select('user_id, reason, excused').eq('meeting_id', found.meeting.id) : { data: [] as { user_id: string; reason: string | null; excused: boolean }[] };
  const name = new Map(expected.map((p) => [p.id, p.name]));
  const missing = (abs ?? []).map((a) => a.user_id as string).filter((id) => !name.has(id));
  if (missing.length) {
    const { data: ps } = await auth.svc.from('profiles').select('id, display_name').in('id', missing);
    for (const p of ps ?? []) name.set(p.id as string, (p.display_name as string | null) || 'Unnamed');
  }
  return NextResponse.json({
    people: expected.map((p) => ({ id: p.id, name: p.name })),
    absences: (abs ?? []).map((a) => ({ user_id: a.user_id, name: name.get(a.user_id as string) ?? 'Unnamed', reason: a.reason, excused: a.excused })),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (!b.user_id || !UUID.test(String(b.user_id))) return NextResponse.json({ error: 'Pick who can’t make it.' }, { status: 400 });
  const found = await resolveOccurrence(auth, b, true);
  if ('error' in found) return found.error;
  const m = found.meeting;
  if (!m) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  const reason = String(b.reason ?? '').trim().slice(0, 140) || null;
  const excused = b.excused !== false;
  // Someone marked absent can't also be recorded as present (or have an answer on file).
  await auth.svc.from('meeting_attendance').delete().eq('meeting_id', m.id).eq('user_id', b.user_id);
  await auth.svc.from('meeting_answers').delete().eq('meeting_id', m.id).eq('user_id', b.user_id);
  const { error } = await auth.svc.from('meeting_absences').upsert({ meeting_id: m.id, user_id: b.user_id, reason, excused, marked_by: auth.user.id }, { onConflict: 'meeting_id,user_id' });
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'mark absent', entityType: 'meeting attendance', entityId: m.id, summary: `Marked someone ${excused ? 'excused' : 'absent'} ahead of ${m.title} (${m.meeting_date})${reason ? `: ${reason}` : ''}`, details: { user_id: b.user_id } });
  return NextResponse.json({ ok: true, meeting_id: m.id });
}

export async function DELETE(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (!b.user_id || !UUID.test(String(b.user_id))) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  const found = await resolveOccurrence(auth, b, false);
  if ('error' in found) return found.error;
  if (found.meeting) await auth.svc.from('meeting_absences').delete().eq('meeting_id', found.meeting.id).eq('user_id', b.user_id);
  return NextResponse.json({ ok: true });
}
