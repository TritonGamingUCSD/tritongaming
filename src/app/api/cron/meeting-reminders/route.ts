import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { sendMeetingReminders } from '@/lib/reminders';
import { sendShiftReminders } from '@/lib/shiftReminders';
import { sendPlanReminders } from '@/lib/meetingPlanServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called on a schedule (see vercel.json) with `Authorization: Bearer $CRON_SECRET`: "today at …" reminders for the
// meetings and internal events happening today. Add `?within=90` and run it often (every 15 minutes needs a Vercel
// plan above Hobby) to send "starting soon" reminders for items in the next 90 minutes instead.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const within = Number(new URL(request.url).searchParams.get('within')) || undefined;
  // Development only: limit who is reminded (so tests never message real people).
  const only = process.env.NODE_ENV !== 'production' ? new URL(request.url).searchParams.get('users')?.split(',').filter(Boolean) : undefined;
  const svc = createServiceClient();
  const result = await sendMeetingReminders(svc, new Date(), within, only);
  // Also: a one-time nudge to people who haven't answered a meeting plan a day after it was made.
  const plans = within ? undefined : await sendPlanReminders(svc, new Date(), only);
  // And the morning-of reminder to everyone who has a shift today.
  const shifts = within ? undefined : await sendShiftReminders(svc, new Date(), only);
  return NextResponse.json({ ...result, plans, shifts });
}
