import { NextResponse } from 'next/server';
import { authorizeMeetings, isMeetingOpen, type MeetingRow } from '@/lib/meetings';
import { MAX_ANSWER_LENGTH, validAnswer } from '@/lib/meetingFun';

// A checked-in person answers (or edits their answer to) the meeting's question.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { answer } = await request.json().catch(() => ({}));
  const text = String(answer ?? '').trim().slice(0, MAX_ANSWER_LENGTH);
  if (!text) return NextResponse.json({ error: 'Type an answer first.' }, { status: 400 });

  const { data } = await auth.svc.from('meetings').select('*').eq('id', id).maybeSingle();
  const m = data as MeetingRow | null;
  if (!m || !m.question) return NextResponse.json({ error: 'There’s no question for this meeting.' }, { status: 404 });
  if (!validAnswer(m.question_type ?? 'text', m.question_options ?? null, text)) return NextResponse.json({ error: 'Pick one of the choices.' }, { status: 400 });
  if (!isMeetingOpen(m)) return NextResponse.json({ error: 'The meeting is over, so answers are closed.' }, { status: 409 });
  const { data: here } = await auth.svc.from('meeting_attendance').select('user_id').eq('meeting_id', id).eq('user_id', auth.user.id).maybeSingle();
  if (!here) return NextResponse.json({ error: 'Check in first to answer.' }, { status: 403 });

  const { error } = await auth.svc.from('meeting_answers').upsert({ meeting_id: id, user_id: auth.user.id, answer: text, updated_at: new Date().toISOString() }, { onConflict: 'meeting_id,user_id' });
  if (error) return NextResponse.json({ error: 'Couldn’t save your answer.' }, { status: 500 });
  return NextResponse.json({ ok: true, answer: text });
}
