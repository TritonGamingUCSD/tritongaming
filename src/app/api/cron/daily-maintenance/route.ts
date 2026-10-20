import { NextResponse } from 'next/server';
import { cronDevOk, cronSecretOk } from '@/lib/core/cronAuth';
import { createServiceClient } from '@/lib/supabase/admin';
import { cleanupNotifications } from '@/lib/notifications/notificationCleanup';
import { cleanupExpiredGrants } from '@/lib/members/roleByEmail';
import { syncInactive } from '@/lib/members/quarters';
import { runTeamSync } from '@/lib/members/teamYears';
import { logSystem } from '@/lib/notifications/audit';
import { alertJobFailed, checkUsage, digestNewMembers, remindStaleHelp } from '@/lib/notifications/adminAlerts';
import { runStorageMaintenance } from '@/lib/storage/storageMaintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The one scheduled job for housekeeping (see vercel.json; the free Vercel plan allows two jobs, each at most once a day), called with
// `Authorization: Bearer $CRON_SECRET`. Every day: delete old notifications (audit alerts after 14 days, routine ones soon after they are read, the rest after 30 to 90 days) and role grants that waited for a first sign-in for 90 days without being used, start a new quarter's
// inactive markers when the quarter changes, and record today's team roster (archive years whose Spring has ended and, when an admin has turned it
// on, move graduates to Alumni). Every day it also checks how full the free plan is and tells the admins at 80% and 90%. On Sundays also: remove stored files nothing uses and re-save pictures smaller.
// `?only=notifications|grants|quarters|teams|help|signups|usage|storage` runs just that step (`?storage=1` adds storage on another day). A failure in one step never stops the
// others. On a dev machine `x-cron-dev: 1` may run only the quarters and teams steps, which are safe at any time.
// The steps that change real data are written to the audit log as the daily job (the notification tidy-up is routine housekeeping, so it is not).
async function recordStep(svc: ReturnType<typeof createServiceClient>, name: string, r: unknown) {
  const x = (r ?? {}) as Record<string, number>;
  const n = (k: string) => Number(x[k]) || 0;
  if (name === 'grants' && n('removed')) await logSystem(svc, 'role grant', `Removed ${n('removed')} unused role grant${n('removed') === 1 ? '' : 's'} that waited 90 days for a first sign-in`, x);
  if (name === 'quarters' && (n('added') || n('removed'))) await logSystem(svc, 'quarter', `New quarter: marked ${n('added')} officer${n('added') === 1 ? '' : 's'} inactive and ${n('removed')} active again`, x);
  if (name === 'teams' && (n('archived') || n('moved'))) await logSystem(svc, 'team year', `Team roster: archived ${n('archived')} finished year${n('archived') === 1 ? '' : 's'}, moved ${n('moved')} graduate${n('moved') === 1 ? '' : 's'} to Alumni`, x);
  if (name === 'storage' && (n('deletedFiles') || n('compressedFiles'))) await logSystem(svc, 'storage', `Weekly tidy-up: removed ${n('deletedFiles')} unused file${n('deletedFiles') === 1 ? '' : 's'}, re-saved ${n('compressedFiles')} picture${n('compressedFiles') === 1 ? '' : 's'} smaller`, x);
}

const SAFE_ANY_TIME = ['quarters', 'teams'];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const only = url.searchParams.get('only');
  const secret = cronSecretOk(request);
  if (!secret && !(cronDevOk(request) && only && SAFE_ANY_TIME.includes(only))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const steps: [string, () => Promise<unknown>][] = [
    ['notifications', () => cleanupNotifications(svc)],
    ['grants', () => cleanupExpiredGrants(svc)],
    ['quarters', async () => { const r = await syncInactive(svc); return { added: r.added.length, removed: r.removed.length, quarter: r.quarter }; }],
    ['teams', () => runTeamSync(svc)],
    ['help', () => remindStaleHelp(svc)],
    ['signups', () => digestNewMembers(svc)],
  ];
  const weekly = new Date().getUTCDay() === 0 || url.searchParams.get('storage') === '1';
  steps.push(['usage', () => checkUsage(svc, { storage: weekly || only === 'usage' })]);
  if (weekly || only === 'storage') steps.push(['storage', () => runStorageMaintenance(svc)]);

  const out: Record<string, unknown> = {};
  for (const [name, run] of steps) {
    if (only && only !== name) continue;
    try { out[name] = await run(); await recordStep(svc, name, out[name]); } catch (e) { console.error(`[cron] ${name} failed:`, e); out[name] = { error: 'failed' }; await alertJobFailed(svc, 'maintenance', name).catch(() => {}); }
  }
  return NextResponse.json(out);
}
