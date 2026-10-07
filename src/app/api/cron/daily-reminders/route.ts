import { NextResponse } from 'next/server';
import { GET as eventReminders } from '../event-reminders/route';
import { GET as meetingReminders } from '../meeting-reminders/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The one scheduled job for everything that messages people (see vercel.json; the free Vercel plan allows two jobs, each at most once a day).
// It runs the event and meeting/shift reminders in turn; a failure in one never stops the other. The separate routes still work on their own.
export async function GET(request: Request) {
  const run = async (name: string, job: (r: Request) => Promise<Response>) => {
    try {
      const res = await job(request);
      return [name, res.ok ? await res.json() : { error: res.status }] as const;
    } catch (e) {
      console.error(`[cron] ${name} failed:`, e);
      return [name, { error: 'failed' }] as const;
    }
  };
  const first = await run('events', eventReminders);
  if ('error' in first[1] && first[1].error === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const second = await run('meetings', meetingReminders);
  return NextResponse.json(Object.fromEntries([first, second]));
}
