import { NextResponse } from 'next/server';
import { authorizeMeetings, buildSchedule } from '@/lib/meetings/meetings';

export const dynamic = 'force-dynamic';

// Everything coming up in the next four weeks that's meant for this person (or planned by them), in date
// order. Read-only: the details a member needs, not the host's controls.
export async function GET() {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const who = { id: auth.user.id, roles: auth.roles };
  const [{ upcoming }, { upcoming: reachable }] = await Promise.all([
    buildSchedule(auth.svc, who, undefined, { strict: true, horizonDays: 28 }),
    buildSchedule(auth.svc, who, undefined, { horizonDays: 28 }),
  ]);
  // Meetings they were not added to but may still check in to (the host left it open to the team). Private ones never come back here.
  const mineKeys = new Set(upcoming.map((m) => m.key));
  const shape = (m: (typeof upcoming)[number]) => ({
      key: m.key, date: m.date, title: m.title, starts_at: m.starts_at, ends_at: m.ends_at, location: m.location,
      // Shown as soon as the host has added one, before the meeting starts.
      doc_url: m.doc_url ?? null,
      repeats: m.repeats, is_today: m.is_today, status: m.status, host_name: m.host_name, hosting: m.host_id === auth.user.id,
  });
  return NextResponse.json({
    meetings: upcoming.filter((m) => m.status !== 'cancelled').map(shape),
    open: reachable.filter((m) => m.status !== 'cancelled' && !mineKeys.has(m.key)).map(shape),
  });
}
