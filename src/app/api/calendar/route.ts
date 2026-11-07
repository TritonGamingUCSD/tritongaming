import { NextResponse } from 'next/server';
import { rangeParams, signedIn } from '@/lib/calendar/auth';
import { loadPortalCalendar } from '@/lib/calendar/server';

export const dynamic = 'force-dynamic';

// The portal calendar for the signed-in person: everything they may see or are part of between ?from= and ?to= (Pacific days, at most 100 days). { items, terms }.
export async function GET(request: Request) {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { from, to } = rangeParams(new URL(request.url));
  return NextResponse.json(await loadPortalCalendar(me.svc, me.user, me.roles, from, to));
}
