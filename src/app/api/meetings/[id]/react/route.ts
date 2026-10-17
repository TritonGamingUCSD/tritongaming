import { NextResponse } from 'next/server';
import { authorizeMeetings, isMeetingOpen, type MeetingRow } from '@/lib/meetings/meetings';
import { isCustomEmoji, customEmojiId } from '@/lib/meetings/meetingFun';
import { notifyMeetingLive } from '@/lib/meetings/meetingLive';

// A checked-in person sends an emoji reaction; it floats up on the exec's screen and adds one to that emoji's total. Lightly rate-limited so one phone can't
// flood the room (12 taps per 10 seconds); the total itself has no limit.
const recent = new Map<string, number[]>();
function throttled(userId: string): boolean {
  const now = Date.now();
  const taps = (recent.get(userId) ?? []).filter((t) => now - t < 10_000);
  if (taps.length >= 12) { recent.set(userId, taps); return true; }
  taps.push(now); recent.set(userId, taps);
  if (recent.size > 5000) for (const [k, v] of recent) if (v.every((t) => now - t >= 10_000)) recent.delete(k);
  return false;
}

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

  // Only a running total per emoji is kept, never who sent it. The flood guard below lives in memory for the same reason: it is best effort per server and
  // forgets everything on its own.
  if (throttled(auth.user.id)) return NextResponse.json({ ok: true, throttled: true });
  await auth.svc.rpc('bump_meeting_reaction', { p_meeting: id, p_emoji: emoji });
  await notifyMeetingLive(id);
  return NextResponse.json({ ok: true });
}
