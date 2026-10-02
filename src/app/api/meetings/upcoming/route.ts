import { NextResponse } from 'next/server';
import { authorizeMeetings, buildSchedule } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

// Everything coming up in the next two months that's meant for this person (or planned by them), in date
// order. Read-only: the details a member needs, not the host's controls.
export async function GET() {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;
  const { upcoming } = await buildSchedule(auth.svc, { id: auth.user.id, roles: auth.roles }, undefined, { strict: true, horizonDays: 60 });
  return NextResponse.json({
    meetings: upcoming.filter((m) => m.status !== 'cancelled').map((m) => ({
      key: m.key, date: m.date, title: m.title, starts_at: m.starts_at, ends_at: m.ends_at, location: m.location, description: m.description,
      repeats: m.repeats, is_today: m.is_today, status: m.status, host_name: m.host_name, hosting: m.host_id === auth.user.id,
    })),
  });
}
