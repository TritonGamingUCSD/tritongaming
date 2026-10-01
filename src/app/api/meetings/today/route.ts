import { NextResponse } from 'next/server';
import { authorizeMeetings, buildSchedule, getTodaysMeetings, isMeetingOpen } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

// What a team member sees: today's meetings (is check-in open, am I in?) and the next one coming up.
export async function GET() {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const todays = await getTodaysMeetings(auth.svc);
  const { data: mine } = todays.length
    ? await auth.svc.from('meeting_attendance').select('meeting_id, checked_in_at').eq('user_id', auth.user.id).in('meeting_id', todays.map((m) => m.id))
    : { data: [] as { meeting_id: string; checked_in_at: string }[] };
  const inAt = new Map((mine ?? []).map((r) => [r.meeting_id, r.checked_in_at]));
  const checkedInIds = todays.filter((m) => inAt.has(m.id)).map((m) => m.id);
  const { data: answers } = checkedInIds.length
    ? await auth.svc.from('meeting_answers').select('meeting_id, answer').eq('user_id', auth.user.id).in('meeting_id', checkedInIds)
    : { data: [] as { meeting_id: string; answer: string }[] };
  const myAnswer = new Map((answers ?? []).map((a) => [a.meeting_id, a.answer]));
  const { upcoming } = await buildSchedule(auth.svc);
  const next = upcoming.find((i) => i.status === 'scheduled' || i.status === 'open');
  return NextResponse.json({
    meetings: todays.map((m) => ({ id: m.id, title: m.title, location: m.location, starts_at: m.starts_at, ends_at: m.ends_at, open: isMeetingOpen(m), checked_in_at: inAt.get(m.id) ?? null,
      // The meeting doc only shows once you've checked in.
      doc_url: inAt.has(m.id) ? m.doc_url : null,
      // The question is a reward for being there: revealed after check-in.
      question: inAt.has(m.id) ? m.question : null,
      my_answer: myAnswer.get(m.id) ?? null })),
    next: next ? { title: next.title, location: next.location, starts_at: next.starts_at, ends_at: next.ends_at, date: next.date } : null,
  });
}
