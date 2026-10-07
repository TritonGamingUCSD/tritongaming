import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGrantedCapabilities } from '@/lib/grantedCapabilities';
import { isTgMember, withGrantedCapabilities } from '@/lib/capabilities';
import { pacificDayKey } from '@/lib/checkinDays';
import { addDaysKey } from '@/lib/meetings';
import { collectCalendarItems } from '@/lib/calendarItems';
import { buildIcsCalendar } from '@/lib/ics';

const UUID = /^[0-9a-f-]{36}$/i;

// A calendar subscription: Google/Apple/Outlook fetch the URL themselves (no sign-in), so the secret token in it is the only credential.
// 'mine' is what the person's portal Calendar shows. 'tg' is the unified TG calendar: that plus every other meeting that is not private
// (just the title, time and who it is for), for TG members only (including recruits and alumni). Last 30 days to 6 months ahead.
export const CALENDAR_NAMES = { mine: 'My TG Calendar', tg: 'TG Calendar' } as const;

export async function calendarFeed(request: Request, rawToken: string, kind: 'mine' | 'tg'): Promise<NextResponse> {
  const token = rawToken.replace(/\.ics$/i, '');
  if (!UUID.test(token)) return new NextResponse('Not found', { status: 404 });
  const svc = createServiceClient();
  const { data: profile } = await svc.from('profiles').select('id').eq('calendar_token', token).maybeSingle();
  if (!profile) return new NextResponse('Not found', { status: 404 });
  const { data: roleRows } = await svc.from('user_roles').select('role, division_id').eq('user_id', profile.id);
  const roles = withGrantedCapabilities(roleRows ?? [], await loadGrantedCapabilities(svc, profile.id).catch(() => []));
  const everyone = kind === 'tg';
  if (everyone && !isTgMember(roles)) return new NextResponse('Not found', { status: 404 });
  const today = pacificDayKey();
  const items = await collectCalendarItems(svc, { id: profile.id as string }, roles, addDaysKey(today, -30), addDaysKey(today, 180), { everyone });
  const origin = new URL(request.url).origin;
  const kindLabel = { event: 'Event', meeting: 'Meeting', internal: 'Internal event', google: 'Google Calendar', shift: 'Shift' } as const;
  // A multi-day event is one entry per day in the portal; in a calendar app it should be one block.
  const seen = new Set<string>();
  const events = items.flatMap((i) => {
    const uid = i.key.startsWith('e|') ? i.key.split('|').slice(0, 2).join('|') : i.key;
    if (seen.has(uid)) return [];
    seen.add(uid);
    return [{ uid: `${uid}@tritongaming`, title: i.title, start: i.start, end: i.end, location: i.location, description: `Triton Gaming · ${kindLabel[i.kind]}${i.audience ? ` · For ${i.audience}` : ''}`, url: `${origin}${i.href}` }];
  });
  return new NextResponse(buildIcsCalendar(events, kind === 'mine' && !isTgMember(roles) ? 'TG Events' : CALENDAR_NAMES[kind]), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900', 'Content-Disposition': `inline; filename="${kind === 'tg' ? 'tg-calendar' : 'my-tg-calendar'}.ics"` },
  });
}
