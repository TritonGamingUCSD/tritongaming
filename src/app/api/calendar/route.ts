import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getUserRoles } from '@/lib/auth';
import { pacificDayKey } from '@/lib/checkinDays';
import { addDaysKey } from '@/lib/meetings';
import { collectCalendarItems } from '@/lib/calendarItems';

export const dynamic = 'force-dynamic';
export type { CalendarItem } from '@/lib/calendarItems';

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
  const items = await collectCalendarItems(createServiceClient(), user, await getUserRoles(), from, to);
  return NextResponse.json({ from, to, today, items });
}
