import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getUserRoles } from '@/lib/core/auth';
import { isTgMember } from '@/lib/portal/capabilities';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { addDaysKey } from '@/lib/meetings/meetings';
import { collectCalendarItems } from '@/lib/events/calendarItems';
import { googleItems } from '@/lib/events/externalCalendar';

export const dynamic = 'force-dynamic';
export type { CalendarItem } from '@/lib/events/calendarItems';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const today = pacificDayKey();
  const from = DATE.test(url.searchParams.get('from') ?? '') ? url.searchParams.get('from')! : addDaysKey(today, -7);
  let to = DATE.test(url.searchParams.get('to') ?? '') ? url.searchParams.get('to')! : addDaysKey(from, 42);
  if (to < from) return NextResponse.json({ error: 'Bad range.' }, { status: 400 });
  if (to > addDaysKey(from, 62)) to = addDaysKey(from, 62);
  const svc = createServiceClient();
  const roles = await getUserRoles();
  // ?scope=all adds everyone else's meetings (not the private ones): for TG members (exec, leads, officers, recruits and alumni).
  const everyone = url.searchParams.get('scope') === 'all';
  if (everyone && !isTgMember(roles)) return NextResponse.json({ error: 'The all-meetings view is for the team.' }, { status: 403 });
  // Students outside the TG team see events only: no meetings, internal events or linked Google Calendar.
  const eventsOnly = !isTgMember(roles);
  const [items, google] = await Promise.all([collectCalendarItems(svc, user, roles, from, to, { everyone }), eventsOnly ? Promise.resolve({ items: [], linked: false, error: null, accounts: [] as { email: string }[] }) : googleItems(svc, user.id, from, to)]);
  // My own linked Google Calendar travels separately: it is only ever returned to me, and never goes in the shared items or the feed.
  return NextResponse.json({ from, to, today, eventsOnly, items, google: google.items, googleLinked: google.linked, googleError: google.error, googleAccounts: google.accounts.map((a) => a.email) });
}
