import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotifications, type NotificationInput } from '@/lib/notifications/notify';
import { MANAGED_BUCKETS, listAllObjects } from '@/lib/storage/storageBuckets';

// Things the admins should hear about without having to look: a risky action by someone else, the free plan filling up, a scheduled job that broke. They go to
// the bell and, for admins who turned web push on, to their devices (the "Admin alerts" kind, which each admin can mute).

export async function adminIds(svc: SupabaseClient): Promise<string[]> {
  const { data } = await svc.from('user_roles').select('user_id').eq('role', 'admin');
  return [...new Set((data ?? []).map((r) => r.user_id as string))];
}

// Tells every admin (except `exclude`). With dedupeDays, the same title is not sent again to someone who already got it in that time, so a daily check
// that keeps finding the same problem does not repeat itself every day.
export async function alertAdmins(svc: SupabaseClient, n: { type: string; title: string; body: string; href?: string; exclude?: string | null; dedupeDays?: number }): Promise<number> {
  return alertPeople(svc, await adminIds(svc), n);
}

export async function alertPeople(svc: SupabaseClient, people: string[], n: { type: string; title: string; body: string; href?: string; exclude?: string | null; dedupeDays?: number }): Promise<number> {
  let ids = people.filter((id) => id !== n.exclude);
  if (n.dedupeDays && ids.length) {
    const since = new Date(Date.now() - n.dedupeDays * 86_400_000).toISOString();
    const { data } = await svc.from('notifications').select('user_id').eq('type', n.type).eq('title', n.title).gte('created_at', since).in('user_id', ids);
    const had = new Set((data ?? []).map((r) => r.user_id as string));
    ids = ids.filter((id) => !had.has(id));
  }
  if (!ids.length) return 0;
  const rows: NotificationInput[] = ids.map((user_id) => ({ user_id, type: n.type, title: n.title, body: n.body, href: n.href ?? '/portal?section=admin&tab=system' }));
  return createNotifications(svc, rows);
}

// A scheduled step threw. Sent at most once a day per step, so a job that fails every run is one alert a day, not a flood.
export function alertJobFailed(svc: SupabaseClient, job: string, step: string): Promise<number> {
  return alertAdmins(svc, { type: 'system_failure', title: `A scheduled job failed: ${job} / ${step}`, body: 'It will try again on its next run. The details are in the host’s logs.', dedupeDays: 1 });
}

// The free plans' ceilings (Supabase Free: 500 MB database, 1 GB of files). Warn when one is 80% used, and again at 90%, each at most once a week.
export const USAGE_LIMITS = { database: 500 * 1024 * 1024, storage: 1024 * 1024 * 1024 };
export const usageLevel = (used: number, limit: number): 0 | 80 | 90 => { const f = used / limit; return f >= 0.9 ? 90 : f >= 0.8 ? 80 : 0; };
const mb = (b: number) => `${Math.round(b / 1024 / 1024)} MB`;

export async function checkUsage(svc: SupabaseClient, opts: { storage: boolean }): Promise<{ database?: number; storage?: number; alerted: number }> {
  const out: { database?: number; storage?: number; alerted: number } = { alerted: 0 };
  const warn = async (what: 'database' | 'storage', used: number, limit: number) => {
    out[what] = used;
    const level = usageLevel(used, limit);
    if (!level) return;
    out.alerted += await alertAdmins(svc, {
      type: 'system_usage',
      title: `The ${what === 'database' ? 'database' : 'file storage'} is ${level}% full`,
      body: `${mb(used)} of ${mb(limit)} on the free plan. Clear out what isn’t needed or move to a bigger plan before it fills.`,
      dedupeDays: 7,
    });
  };
  const { data: db } = await svc.rpc('admin_db_stats');
  const bytes = Number((db as { database_bytes?: number } | null)?.database_bytes);
  if (Number.isFinite(bytes) && bytes > 0) await warn('database', bytes, USAGE_LIMITS.database);
  if (opts.storage) {
    let total = 0;
    for (const { bucket } of MANAGED_BUCKETS) total += (await listAllObjects(svc, bucket)).reduce((s, o) => s + o.size, 0);
    await warn('storage', total, USAGE_LIMITS.storage);
  }
  return out;
}

// The same rule the database uses to ping admins about a risky action (see audit_alert_admins). The ping is put in the bell by the database itself, so it
// never went through the code that pushes to phones; logAudit calls this so those alerts reach devices too.
export const isRiskyAudit = (e: { action: string; entityType: string }) =>
  ['delete', 'merge', 'reverse'].includes(e.action) || e.entityType === 'account' || (e.entityType === 'tier' && e.action === 'update') || (e.entityType === 'points' && e.action === 'adjust');

// Help tickets nobody has picked up. One notice to the staff when any ticket has been open for two days or more, at most every other day.
export const STALE_HELP_DAYS = 2;
export async function remindStaleHelp(svc: SupabaseClient): Promise<number> {
  const before = new Date(Date.now() - STALE_HELP_DAYS * 86_400_000).toISOString();
  const { data } = await svc.from('help_tickets').select('subject').eq('status', 'open').lt('created_at', before).order('created_at').limit(50);
  if (!data?.length) return 0;
  const { data: staff } = await svc.from('user_roles').select('user_id').in('role', ['exec', 'admin']);
  const names = data.slice(0, 3).map((t) => `“${String(t.subject).slice(0, 50)}”`).join(', ');
  return alertPeople(svc, [...new Set((staff ?? []).map((r) => r.user_id as string))], {
    type: 'help_ticket', title: `${data.length} help ticket${data.length === 1 ? ' is' : 's are'} still waiting`,
    body: `Open for over ${STALE_HELP_DAYS} days: ${names}${data.length > 3 ? ` and ${data.length - 3} more` : ''}.`, href: '/portal/help', dedupeDays: 2,
  });
}

// A short note to the admins when people joined in the last day. Throwaway "ZZ" test accounts are not counted.
export async function digestNewMembers(svc: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await svc.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since).not('display_name', 'ilike', 'zz%');
  if (!count) return 0;
  return alertAdmins(svc, { type: 'system_signups', title: `${count} new member${count === 1 ? '' : 's'} joined`, body: `In the last 24 hours. See them under Admin → Members.`, href: '/portal?section=admin&tab=members', dedupeDays: 1 });
}
