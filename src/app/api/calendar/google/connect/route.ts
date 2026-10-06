import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authUrl, googleConfigured, siteOrigin } from '@/lib/googleCalendar';

export const dynamic = 'force-dynamic';

// Step one of linking: send the signed-in member to Google's own consent screen, which asks only to see their calendar events.
export async function GET(request: Request) {
  const origin = siteOrigin(request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/portal/calendar?gcal=not_configured`);
  const state = crypto.randomBytes(24).toString('hex');
  const res = NextResponse.redirect(authUrl(origin, state));
  res.cookies.set('gcal_state', state, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/api/calendar/google', maxAge: 600 });
  return res;
}
