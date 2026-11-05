import { NextResponse } from 'next/server';
import { authorizeWorkspace } from '@/lib/events/workspace';

export const dynamic = 'force-dynamic';

// The events to pick from when something is made "for an event" (a poll, a Q&A, a booth): the recent and coming ones, newest first. For anyone on the team who can make such things.
export async function GET() {
  const auth = await authorizeWorkspace();
  if (auth.error) return auth.error;
  const { data } = await auth.svc.from('events').select('id, title, start_date').order('start_date', { ascending: false }).limit(60);
  return NextResponse.json({ events: data ?? [] });
}
