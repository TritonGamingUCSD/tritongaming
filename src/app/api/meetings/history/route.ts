import { NextResponse } from 'next/server';
import { authorizeMeetings, getExpectedPeople } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

// Past meetings (newest first) and each person's attendance across the most recent ones.
export async function GET() {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { data: meetings } = await auth.svc.from('meetings').select('id, title, meeting_date').eq('cancelled', false).not('opened_at', 'is', null).order('meeting_date', { ascending: false }).limit(26);
  const ids = (meetings ?? []).map((m) => m.id as string);
  const [{ data: rows }, people] = await Promise.all([
    ids.length ? auth.svc.from('meeting_attendance').select('meeting_id, user_id').in('meeting_id', ids) : Promise.resolve({ data: [] as { meeting_id: string; user_id: string }[] }),
    getExpectedPeople(auth.svc),
  ]);
  const perMeeting = new Map<string, Set<string>>();
  for (const r of rows ?? []) {
    const set = perMeeting.get(r.meeting_id as string) ?? new Set<string>();
    set.add(r.user_id as string);
    perMeeting.set(r.meeting_id as string, set);
  }
  const total = (meetings ?? []).length;
  return NextResponse.json({
    meetings: (meetings ?? []).map((m) => ({ ...m, count: perMeeting.get(m.id as string)?.size ?? 0 })),
    people: people.map((p) => ({ id: p.id, name: p.name, attended: (meetings ?? []).filter((m) => perMeeting.get(m.id as string)?.has(p.id)).length, total })),
  });
}
