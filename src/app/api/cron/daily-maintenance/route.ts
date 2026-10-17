import { NextResponse } from 'next/server';
import { cronDevOk, cronSecretOk } from '@/lib/core/cronAuth';
import { createServiceClient } from '@/lib/supabase/admin';
import { cleanupNotifications } from '@/lib/notifications/notificationCleanup';
import { cleanupMeetingReactions } from '@/lib/meetings/reactionCleanup';
import { cleanupExpiredGrants } from '@/lib/members/roleByEmail';
import { syncInactive } from '@/lib/members/quarters';
import { runTeamSync } from '@/lib/members/teamYears';
import { runStorageMaintenance } from '@/lib/storage/storageMaintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The one scheduled job for housekeeping (see vercel.json; the free Vercel plan allows two jobs, each at most once a day), called with
// `Authorization: Bearer $CRON_SECRET`. Every day: delete old notifications (audit alerts after 14 days, routine ones soon after they are read, the rest after 30 to 90 days) meeting reactions older than a week and role grants that waited for a first sign-in for 90 days without being used, start a new quarter's
// inactive markers when the quarter changes, and record today's team roster (archive years whose Spring has ended and, when an admin has turned it
// on, move graduates to Alumni). On Sundays also: remove stored files nothing uses and re-save pictures smaller.
// `?only=notifications|reactions|grants|quarters|teams|storage` runs just that step (`?storage=1` adds storage on another day). A failure in one step never stops the
// others. On a dev machine `x-cron-dev: 1` may run only the quarters and teams steps, which are safe at any time.
const SAFE_ANY_TIME = ['quarters', 'teams'];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const only = url.searchParams.get('only');
  const secret = cronSecretOk(request);
  if (!secret && !(cronDevOk(request) && only && SAFE_ANY_TIME.includes(only))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const steps: [string, () => Promise<unknown>][] = [
    ['notifications', () => cleanupNotifications(svc)],
    ['reactions', () => cleanupMeetingReactions(svc)],
    ['grants', () => cleanupExpiredGrants(svc)],
    ['quarters', async () => { const r = await syncInactive(svc); return { added: r.added.length, removed: r.removed.length, quarter: r.quarter }; }],
    ['teams', () => runTeamSync(svc)],
  ];
  if (new Date().getUTCDay() === 0 || url.searchParams.get('storage') === '1' || only === 'storage') steps.push(['storage', () => runStorageMaintenance(svc)]);

  const out: Record<string, unknown> = {};
  for (const [name, run] of steps) {
    if (only && only !== name) continue;
    try { out[name] = await run(); } catch (e) { console.error(`[cron] ${name} failed:`, e); out[name] = { error: 'failed' }; }
  }
  return NextResponse.json(out);
}
