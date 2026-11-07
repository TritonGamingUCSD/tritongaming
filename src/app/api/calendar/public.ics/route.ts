import { createServiceClient } from '@/lib/supabase/admin';
import { addDaysKey, pacificDayKey } from '@/lib/core/timezone';
import { buildIcs } from '@/lib/calendar/ics';
import { loadPublicCalendar } from '@/lib/calendar/server';

export const dynamic = 'force-dynamic';

// The public calendar as a subscribable file (Google, Apple, Outlook): the last month and the next eight, optionally one division's (?division=<address>).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = pacificDayKey();
  const division = url.searchParams.get('division');
  const data = await loadPublicCalendar(createServiceClient(), addDaysKey(today, -30), addDaysKey(today, 240), division, 280);
  const body = buildIcs(data.items, { name: division ? `Triton Gaming: ${division}` : 'Triton Gaming', origin: url.origin });
  return new Response(body, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, s-maxage=900', 'Content-Disposition': 'inline; filename="triton-gaming.ics"' },
  });
}
