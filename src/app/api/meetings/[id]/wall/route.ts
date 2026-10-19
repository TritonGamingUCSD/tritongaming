import { NextResponse } from 'next/server';
import { authorizeMeetings, isMeetingOpen, type MeetingRow } from '@/lib/meetings/meetings';
import { isCustomEmoji, customEmojiId } from '@/lib/meetings/meetingFun';
import { WALL_MAX, validWallSpot } from '@/lib/meetings/meetingWall';
import { notifyMeetingLive } from '@/lib/meetings/meetingLive';

export const dynamic = 'force-dynamic';

// The emoji wall. A checked-in person reads what is on it and adds one emoji at a spot on the side strips. No sender is stored; like the reactions, a light
// flood guard (5 per 20 seconds) lives in memory, and past WALL_MAX the oldest placement is replaced.
const recent = new Map<string, number[]>();
function throttled(userId: string): boolean {
  const now = Date.now();
  const taps = (recent.get(userId) ?? []).filter((t) => now - t < 20_000);
  if (taps.length >= 5) { recent.set(userId, taps); return true; }
  taps.push(now); recent.set(userId, taps);
  if (recent.size > 5000) for (const [k, v] of recent) if (v.every((t) => now - t >= 20_000)) recent.delete(k);
  return false;
}

async function here(svc: NonNullable<Awaited<ReturnType<typeof authorizeMeetings>>['svc']>, meetingId: string, userId: string) {
  const { data } = await svc.from('meeting_attendance').select('user_id').eq('meeting_id', meetingId).eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!(await here(auth.svc, id, auth.user.id))) return NextResponse.json({ error: 'Check in first.' }, { status: 403 });
  const { data } = await auth.svc.from('meeting_wall').select('id, emoji, x, y').eq('meeting_id', id).order('created_at').limit(WALL_MAX);
  return NextResponse.json({ wall: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { emoji, x, y } = await request.json().catch(() => ({}));
  if (typeof emoji !== 'string' || !isCustomEmoji(emoji) || !validWallSpot(x, y)) return NextResponse.json({ error: 'Not a spot on the wall.' }, { status: 400 });
  const { data: ce } = await auth.svc.from('custom_emojis').select('id').eq('id', customEmojiId(emoji)).eq('status', 'approved').maybeSingle();
  if (!ce) return NextResponse.json({ error: 'Unknown emoji.' }, { status: 400 });

  const { data } = await auth.svc.from('meetings').select('*').eq('id', id).maybeSingle();
  const m = data as MeetingRow | null;
  if (!m || !isMeetingOpen(m)) return NextResponse.json({ error: 'The wall is closed.' }, { status: 409 });
  if (!(await here(auth.svc, id, auth.user.id))) return NextResponse.json({ error: 'Check in first.' }, { status: 403 });
  if (throttled(auth.user.id)) return NextResponse.json({ ok: true, throttled: true });

  const { count } = await auth.svc.from('meeting_wall').select('id', { count: 'exact', head: true }).eq('meeting_id', id);
  if ((count ?? 0) >= WALL_MAX) {
    const { data: oldest } = await auth.svc.from('meeting_wall').select('id').eq('meeting_id', id).order('created_at').limit(Math.max(1, (count ?? 0) - WALL_MAX + 1));
    if (oldest?.length) await auth.svc.from('meeting_wall').delete().in('id', oldest.map((o) => o.id as string));
  }
  const { error } = await auth.svc.from('meeting_wall').insert({ meeting_id: id, emoji, x, y });
  if (error) return NextResponse.json({ error: 'Couldn’t place it.' }, { status: 500 });
  await notifyMeetingLive(id);
  return NextResponse.json({ ok: true });
}
