import { NextResponse } from 'next/server';
import { authorizeMeetings, getTodaysMeetings, isMeetingOpen, isValidMeetingCode } from '@/lib/meetings';

// A team member typing the code shown in the room. The code identifies the meeting: it's checked
// against every meeting that's open today. Only ever checks in the caller themselves.
export async function POST(request: Request) {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the 6-digit code from the screen.' }, { status: 400 });

  const open = (await getTodaysMeetings(auth.svc)).filter((m) => isMeetingOpen(m));
  if (open.length === 0) return NextResponse.json({ error: 'Check-in isn’t open right now.' }, { status: 409 });

  const match = open.find((m) => isValidMeetingCode(m.code_secret, code));
  if (!match) return NextResponse.json({ error: 'That code is wrong or has expired — check the screen for the current one.' }, { status: 400 });

  const { data: existing } = await auth.svc.from('meeting_attendance').select('checked_in_at').eq('meeting_id', match.id).eq('user_id', auth.user.id).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, already: true, title: match.title, doc_url: match.doc_url, checked_in_at: existing.checked_in_at });

  const { data, error } = await auth.svc.from('meeting_attendance')
    .upsert({ meeting_id: match.id, user_id: auth.user.id, method: 'code' }, { onConflict: 'meeting_id,user_id', ignoreDuplicates: true })
    .select('checked_in_at').maybeSingle();
  if (error) return NextResponse.json({ error: 'Couldn’t check you in. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true, title: match.title, doc_url: match.doc_url, checked_in_at: data?.checked_in_at ?? new Date().toISOString() });
}
