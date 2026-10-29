import { NextResponse } from 'next/server';
import { cronSecretOk } from '@/lib/core/cronAuth';
import { createServiceClient } from '@/lib/supabase/admin';
import { sendEventReminders } from '@/lib/notifications/eventReminders';
import { sendMeetingReminders } from '@/lib/meetings/reminders';
import { alertJobFailed } from '@/lib/notifications/adminAlerts';
import { sendPlanReminders } from '@/lib/meetings/meetingPlanServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The one scheduled job for everything that messages people (see vercel.json; the free Vercel plan allows two jobs, each at most once a day), called
// with `Authorization: Bearer $CRON_SECRET`. It sends, in turn:
//   • the day-before and hour-before event reminders,
//   • "today at …" reminders for the meetings happening today,
//   • a one-time nudge to people who haven't answered a meeting plan a day after it was made.
// A failure in one never stops the next. Add `?within=90` and run it often (every 15 minutes needs a Vercel plan above Hobby) to send "starting soon"
// meeting reminders for the next 90 minutes instead. In development `?users=id,id` limits who is messaged, so tests never reach real people.
export async function GET(request: Request) {
  if (!cronSecretOk(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const within = Number(url.searchParams.get('within')) || undefined;
  const only = process.env.NODE_ENV !== 'production' ? url.searchParams.get('users')?.split(',').filter(Boolean) : undefined;
  const svc = createServiceClient();
  const step = async <T>(name: string, run: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      return await run();
    } catch (e) {
      console.error(`[cron] ${name} failed:`, e);
      await alertJobFailed(svc, 'reminders', name).catch(() => {});
      return { error: 'failed' };
    }
  };
  const events = await step('events', () => sendEventReminders(svc));
  const meetings = await step('meetings', () => sendMeetingReminders(svc, new Date(), within, only));
  const plans = within ? undefined : await step('plans', () => sendPlanReminders(svc, new Date(), only));
  return NextResponse.json({ events, meetings, plans });
}
