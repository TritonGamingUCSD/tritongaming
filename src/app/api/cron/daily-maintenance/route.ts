import { NextResponse } from 'next/server';
import { GET as cleanupNotifications } from '../cleanup-notifications/route';
import { GET as quarterSync } from '../quarter-sync/route';
import { GET as teamSync } from '../team-sync/route';
import { GET as storageMaintenance } from '../storage-maintenance/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The one scheduled job for housekeeping (see vercel.json; the free Vercel plan allows two jobs, each at most once a day). Every day: tidy old
// notifications and bring the quarter and team-year records in line with the calendar. On Sundays also: remove stored files nothing uses.
// A failure in one step never stops the others. The separate routes still work on their own.
export async function GET(request: Request) {
  const steps: [string, (r: Request) => Promise<Response>][] = [
    ['notifications', cleanupNotifications],
    ['quarters', quarterSync],
    ['teams', teamSync],
  ];
  if (new Date().getUTCDay() === 0 || new URL(request.url).searchParams.get('storage') === '1') steps.push(['storage', storageMaintenance]);
  const out: Record<string, unknown> = {};
  for (const [name, job] of steps) {
    try {
      const res = await job(request);
      if (res.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      out[name] = res.ok ? await res.json() : { error: res.status };
    } catch (e) {
      console.error(`[cron] ${name} failed:`, e);
      out[name] = { error: 'failed' };
    }
  }
  return NextResponse.json(out);
}
