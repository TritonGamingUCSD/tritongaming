import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { rangeParams } from '@/lib/calendar/auth';
import { loadPublicCalendar } from '@/lib/calendar/server';

export const dynamic = 'force-dynamic';

// The public calendar: what is published for everyone (events, public tournaments, streams, quarter dates) between ?from= and ?to=, optionally of one division (?division=<address>). No sign-in.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const { from, to } = rangeParams(url);
  const data = await loadPublicCalendar(createServiceClient(), from, to, url.searchParams.get('division'));
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
