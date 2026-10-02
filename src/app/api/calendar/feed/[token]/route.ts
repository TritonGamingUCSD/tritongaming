import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGrantedCapabilities } from '@/lib/grantedCapabilities';
import { withGrantedCapabilities } from '@/lib/capabilities';
import { pacificDayKey } from '@/lib/checkinDays';
import { addDaysKey } from '@/lib/meetings';
import { collectCalendarItems } from '@/lib/calendarItems';
import { buildIcsCalendar } from '@/lib/ics';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

// A person's private calendar subscription: Google/Apple/Outlook fetch this URL themselves (no sign-in), so the
// secret token in it is the only credential. Shows what their portal Calendar shows (last 30 days to 6 months ahead).
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, '');
  if (!UUID.test(token)) return new NextResponse('Not found', { status: 404 });
  const svc = createServiceClient();
  const { data: profile } = await svc.from('profiles').select('id, display_name').eq('calendar_token', token).maybeSingle();
  if (!profile) return new NextResponse('Not found', { status: 404 });
  const { data: roleRows } = await svc.from('user_roles').select('role, division_id').eq('user_id', profile.id);
  const roles = withGrantedCapabilities(roleRows ?? [], await loadGrantedCapabilities(svc, profile.id).catch(() => []));
  const today = pacificDayKey();
  const items = await collectCalendarItems(svc, { id: profile.id as string }, roles, addDaysKey(today, -30), addDaysKey(today, 180));
  const origin = new URL(request.url).origin;
  const kindLabel = { event: 'Event', meeting: 'Meeting', internal: 'Internal event' } as const;
  // A multi-day event is one entry per day in the portal; in a calendar app it should be one block.
  const seen = new Set<string>();
  const events = items.flatMap((i) => {
    const uid = i.key.startsWith('e|') ? i.key.split('|').slice(0, 2).join('|') : i.key;
    if (seen.has(uid)) return [];
    seen.add(uid);
    return [{ uid: `${uid}@tritongaming`, title: i.title, start: i.start, end: i.end, location: i.location, description: `Triton Gaming · ${kindLabel[i.kind]}`, url: `${origin}${i.href}` }];
  });
  return new NextResponse(buildIcsCalendar(events, 'Triton Gaming'), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900', 'Content-Disposition': 'inline; filename="triton-gaming.ics"' },
  });
}
