import { NextResponse } from 'next/server';
import { signedIn } from '@/lib/calendar/auth';
import { homeFor } from '@/lib/portal/audience';

export const dynamic = 'force-dynamic';

// Where the home-screen app opens (the manifest's start_url): the right home for whoever it is. Staff and members go to the portal, students and guests to /me, and someone signed out to sign in first.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const me = await signedIn();
  if (!me) return NextResponse.redirect(new URL('/login?next=/app', url.origin));
  return NextResponse.redirect(new URL(homeFor(me.roles), url.origin));
}
