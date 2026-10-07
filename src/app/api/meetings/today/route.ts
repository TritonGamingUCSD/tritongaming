import { NextResponse } from 'next/server';
import { authorizeMeetings, buildSchedule, checkInOpensAt, getTodaysMeetings, isCheckInAccepting, isMeetingOpen } from '@/lib/meetings/meetings';
import { canAttendMeeting } from '@/lib/meetings/meetingAudience';

export const dynamic = 'force-dynamic';

// What a team member sees: today's meetings (is check-in open, am I in?) and the next one coming up.
export async function GET() {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const todays = (await getTodaysMeetings(auth.svc)).filter((m) => canAttendMeeting(m, auth.user.id, auth.roles));
  const { data: mine } = todays.length
    ? await auth.svc.from('meeting_attendance').select('meeting_id, checked_in_at').eq('user_id', auth.user.id).in('meeting_id', todays.map((m) => m.id))
    : { data: [] as { meeting_id: string; checked_in_at: string }[] };
  const inAt = new Map((mine ?? []).map((r) => [r.meeting_id, r.checked_in_at]));
  const checkedInIds = todays.filter((m) => inAt.has(m.id)).map((m) => m.id);
  const { data: answers } = checkedInIds.length
    ? await auth.svc.from('meeting_answers').select('meeting_id, answer').eq('user_id', auth.user.id).in('meeting_id', checkedInIds)
    : { data: [] as { meeting_id: string; answer: string }[] };
  const myAnswer = new Map((answers ?? []).map((a) => [a.meeting_id, a.answer]));
  const { upcoming } = await buildSchedule(auth.svc, { id: auth.user.id, roles: auth.roles });
  const next = upcoming.find((i) => i.status === 'scheduled' || i.status === 'open');
  return NextResponse.json({
    meetings: todays.map((m) => ({ id: m.id, title: m.title, description: m.description, location: m.location, starts_at: m.starts_at, ends_at: m.ends_at, open: isMeetingOpen(m), accepting: isCheckInAccepting(m), opens_at: new Date(checkInOpensAt(m)).toISOString(), checked_in_at: inAt.get(m.id) ?? null,
      // The meeting doc shows as soon as one has been added (these are only the meetings you are invited to), before and after check-in.
      doc_url: m.doc_url ?? null,
      // The question is a reward for being there: revealed after check-in.
      question: inAt.has(m.id) ? m.question : null,
      question_type: m.question_type ?? 'text',
      question_options: inAt.has(m.id) ? m.question_options ?? null : null,
      my_answer: myAnswer.get(m.id) ?? null })),
    next: next ? { doc_url: next.doc_url ?? null, title: next.title, description: next.description, location: next.location, starts_at: next.starts_at, ends_at: next.ends_at, date: next.date } : null,
  });
}
