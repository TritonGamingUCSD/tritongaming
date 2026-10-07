import { NextResponse } from 'next/server';
import { authorizeMeetings, isMeetingOpen, type MeetingRow } from '@/lib/meetings/meetings';
import { isCustomEmoji, customEmojiId } from '@/lib/meetings/meetingFun';

// A checked-in person sends an emoji reaction; it floats up on the exec's screen. Lightly
// rate-limited so one phone can't flood the room.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { emoji } = await request.json().catch(() => ({}));
  // Only the club's own approved custom emojis can be sent.
  if (typeof emoji !== 'string' || !isCustomEmoji(emoji)) return NextResponse.json({ error: 'Unknown reaction.' }, { status: 400 });
  const { data: ce } = await auth.svc.from('custom_emojis').select('id').eq('id', customEmojiId(emoji)).eq('status', 'approved').maybeSingle();
  if (!ce) return NextResponse.json({ error: 'Unknown reaction.' }, { status: 400 });

  const { data } = await auth.svc.from('meetings').select('*').eq('id', id).maybeSingle();
  const m = data as MeetingRow | null;
  if (!m || !isMeetingOpen(m)) return NextResponse.json({ error: 'Reactions are closed.' }, { status: 409 });
  const { data: here } = await auth.svc.from('meeting_attendance').select('user_id').eq('meeting_id', id).eq('user_id', auth.user.id).maybeSingle();
  if (!here) return NextResponse.json({ error: 'Check in first to react.' }, { status: 403 });

  const since = new Date(Date.now() - 10_000).toISOString();
  const { count } = await auth.svc.from('meeting_reactions').select('id', { count: 'exact', head: true }).eq('meeting_id', id).eq('user_id', auth.user.id).gte('created_at', since);
  if ((count ?? 0) >= 12) return NextResponse.json({ ok: true, throttled: true });

  await auth.svc.from('meeting_reactions').insert({ meeting_id: id, user_id: auth.user.id, emoji });
  return NextResponse.json({ ok: true });
}
