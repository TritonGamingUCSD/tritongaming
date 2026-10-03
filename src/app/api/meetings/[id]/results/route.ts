import { NextResponse } from 'next/server';
import { authorizeMeetings, isMeetingOpen, type MeetingRow } from '@/lib/meetings';
import { tally } from '@/lib/meetingFun';

export const dynamic = 'force-dynamic';

// Live poll / rating results for someone who is checked in (so the phone can show the bars moving). Only totals, never who chose what.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data } = await auth.svc.from('meetings').select('*').eq('id', id).maybeSingle();
  const m = data as MeetingRow | null;
  if (!m || !m.question || (m.question_type ?? 'text') === 'text') return NextResponse.json({ error: 'No poll for this meeting.' }, { status: 404 });
  const { data: here } = await auth.svc.from('meeting_attendance').select('user_id').eq('meeting_id', id).eq('user_id', auth.user.id).maybeSingle();
  if (!here) return NextResponse.json({ error: 'Check in first to see results.' }, { status: 403 });
  const { data: rows } = await auth.svc.from('meeting_answers').select('answer').eq('meeting_id', id);
  return NextResponse.json({ open: isMeetingOpen(m), ...tally(m.question_type, m.question_options, (rows ?? []).map((r) => r.answer as string)) });
}
