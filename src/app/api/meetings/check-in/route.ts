import { NextResponse } from 'next/server';
import { authorizeMeetings, checkInOpensAt, getTodaysMeetings, isCheckInAccepting, isMeetingOpen, isValidMeetingCode } from '@/lib/meetings/meetings';
import { canAttendMeeting } from '@/lib/meetings/meetingAudience';

// A team member typing the code shown in the room. The code identifies the meeting: it's checked
// against every meeting that's open today. Only ever checks in the caller themselves.
export async function POST(request: Request) {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the 6-digit code from the screen.' }, { status: 400 });

  const mine = (await getTodaysMeetings(auth.svc)).filter((m) => isMeetingOpen(m) && canAttendMeeting(m, auth.user.id, auth.roles));
  const open = mine.filter((m) => isCheckInAccepting(m));
  const opensMsg = (m: (typeof mine)[number]) => `Check-in for ${m.title} opens at ${new Date(checkInOpensAt(m)).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })}, 10 minutes before it starts.`;
  if (open.length === 0) {
    const soonest = [...mine].sort((a, b) => checkInOpensAt(a) - checkInOpensAt(b))[0];
    return NextResponse.json({ error: soonest ? opensMsg(soonest) : 'Check-in isn’t open right now.' }, { status: 409 });
  }

  const match = open.find((m) => isValidMeetingCode(m.code_secret, code));
  if (!match) {
    // A real code for a meeting that isn't open to members yet gets a clearer answer than "wrong code".
    const early = mine.find((m) => !isCheckInAccepting(m) && isValidMeetingCode(m.code_secret, code));
    if (early) return NextResponse.json({ error: opensMsg(early) }, { status: 409 });
  }
  if (!match) return NextResponse.json({ error: 'That code is wrong or has expired — check the screen for the current one.' }, { status: 400 });

  const { data: existing } = await auth.svc.from('meeting_attendance').select('checked_in_at').eq('meeting_id', match.id).eq('user_id', auth.user.id).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, already: true, title: match.title, doc_url: match.doc_url, checked_in_at: existing.checked_in_at });

  // They came after all: take back any "can't make it" recorded ahead of time.
  await auth.svc.from('meeting_absences').delete().eq('meeting_id', match.id).eq('user_id', auth.user.id);
  const { data, error } = await auth.svc.from('meeting_attendance')
    .upsert({ meeting_id: match.id, user_id: auth.user.id, method: 'code' }, { onConflict: 'meeting_id,user_id', ignoreDuplicates: true })
    .select('checked_in_at').maybeSingle();
  if (error) return NextResponse.json({ error: 'Couldn’t check you in. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true, title: match.title, doc_url: match.doc_url, checked_in_at: data?.checked_in_at ?? new Date().toISOString() });
}
