import { createServiceClient } from '@/lib/supabase/admin';
import { addDaysKey, pacificDayKey } from '@/lib/core/timezone';
import { rolesOf } from '@/lib/calendar/auth';
import { buildIcs } from '@/lib/calendar/ics';
import { loadPortalCalendar } from '@/lib/calendar/server';

export const dynamic = 'force-dynamic';

// One person's calendar as a file for Google, Apple or Outlook Calendar, found by the secret in the address (/api/calendar/feed/<secret>.ics). It has what the portal calendar has, only theirs: last month and the next eight. A wrong or replaced secret gets nothing.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, '');
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response('Not found', { status: 404 });
  const svc = createServiceClient();
  const { data } = await svc.from('calendar_feeds').select('user_id').eq('token', token).maybeSingle();
  if (!data) return new Response('Not found', { status: 404 });
  const userId = data.user_id as string;
  const today = pacificDayKey();
  const cal = await loadPortalCalendar(svc, { id: userId }, await rolesOf(svc, userId), addDaysKey(today, -30), addDaysKey(today, 240), 280);
  const body = buildIcs(cal.items, { name: 'Triton Gaming: my calendar', origin: new URL(request.url).origin });
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' } });
}
