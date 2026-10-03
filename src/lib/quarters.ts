import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { pacificDayKey } from '@/lib/checkinDays';
import { createNotifications } from '@/lib/notify';
import { invalidate } from '@/lib/revalidate';

// Quarters and "inactive". An officer or lead can sit a quarter out: they keep their title, but are not expected at meetings, are left out of the strike
// tracker, and have view-only access. An exec or admin marks them for a quarter; the next quarter starts everyone active again. While a mark is in
// effect the person carries an 'inactive' marker row in user_roles (see 20261004100000_inactive_role.sql), which hasCapability()/has_capability() read.

export type Term = 'fall' | 'winter' | 'spring';
export const TERMS: Term[] = ['fall', 'winter', 'spring'];
export interface Quarter { id: string; term: Term; start_year: number; starts_on: string; ends_on: string }

const TERM_LABEL: Record<Term, string> = { fall: 'Fall', winter: 'Winter', spring: 'Spring' };
// Fall belongs to the calendar year the academic year starts in; Winter and Spring to the next one.
export const quarterYear = (q: Pick<Quarter, 'term' | 'start_year'>) => (q.term === 'fall' ? q.start_year : q.start_year + 1);
export const quarterName = (q: Pick<Quarter, 'term' | 'start_year'>) => `${TERM_LABEL[q.term]} ${quarterYear(q)}`;
// 2026 → "2026-27"
export const academicYearLabel = (startYear: number) => `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

const byStart = (a: Quarter, b: Quarter) => a.starts_on.localeCompare(b.starts_on);

// The quarter we are in: the latest one that has started. Breaks between quarters (and the summer) belong to the quarter before them, so a mark does not
// quietly switch off over winter break; the next quarter's start is what switches everything over.
export function currentQuarter(quarters: Quarter[], today: string = pacificDayKey()): Quarter | null {
  const started = quarters.filter((q) => q.starts_on <= today).sort(byStart);
  return started.length ? started[started.length - 1] : null;
}
// Quarters that can still be marked: the current one and any that have not started.
export function markableQuarters(quarters: Quarter[], today: string = pacificDayKey()): Quarter[] {
  const cur = currentQuarter(quarters, today);
  return [...quarters].sort(byStart).filter((q) => q.starts_on > today || q.id === cur?.id);
}

// Only officers and leads can be inactive (exec and admin never are).
export const canBeInactive = (roles: { role: string }[]) => roles.some((r) => r.role === 'officer' || r.role === 'lead') && !roles.some((r) => r.role === 'exec' || r.role === 'admin');

// Everyone who is inactive right now.
export async function inactiveIds(svc: SupabaseClient): Promise<Set<string>> {
  const { data } = await svc.from('user_roles').select('user_id').eq('role', 'inactive');
  return new Set((data ?? []).map((r) => r.user_id as string));
}

export async function loadQuarters(svc: SupabaseClient): Promise<Quarter[]> {
  const { data } = await svc.from('academic_quarters').select('id, term, start_year, starts_on, ends_on').order('starts_on');
  return (data ?? []) as Quarter[];
}

// 'manage' = exec / admin (the Quarter status page); 'setup' = admin only (the quarter dates).
export async function authorizeQuarters(mode: 'manage' | 'setup') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const ok = mode === 'manage' ? hasCapability(roles ?? [], 'manage_quarters') : hasCapability(roles ?? [], 'manage_roles');
  if (!ok) return { error: NextResponse.json({ error: mode === 'manage' ? 'Only exec and admins can change quarter status.' : 'Only admins can set the quarter dates.' }, { status: 403 }) };
  return { user, svc: createServiceClient(), canSetup: hasCapability(roles ?? [], 'manage_roles') };
}

// Make the inactive markers match the calendar: everyone marked for the current quarter carries the marker, everyone else does not. Run after every change
// and daily (so a new quarter switches people over by itself). Tells people when they go inactive and when they are active again.
export async function syncInactive(svc: SupabaseClient, today: string = pacificDayKey()): Promise<{ added: string[]; removed: string[]; quarter: string | null }> {
  const quarters = await loadQuarters(svc);
  const cur = currentQuarter(quarters, today);
  const [{ data: marks }, { data: markers }] = await Promise.all([
    cur ? svc.from('officer_quarter_status').select('user_id').eq('quarter_id', cur.id) : Promise.resolve({ data: [] as { user_id: string }[] }),
    svc.from('user_roles').select('id, user_id').eq('role', 'inactive'),
  ]);
  const marked = [...new Set((marks ?? []).map((m) => m.user_id as string))];
  // Only people who are still eligible (a mark on someone who has since become exec, or lost their officer title, does nothing).
  const { data: roleRows } = marked.length ? await svc.from('user_roles').select('user_id, role').in('user_id', marked) : { data: [] as { user_id: string; role: string }[] };
  const rolesOf = new Map<string, { role: string }[]>();
  for (const r of roleRows ?? []) rolesOf.set(r.user_id as string, [...(rolesOf.get(r.user_id as string) ?? []), { role: r.role as string }]);
  const want = new Set(marked.filter((id) => canBeInactive(rolesOf.get(id) ?? [])));
  const have = new Map((markers ?? []).map((m) => [m.user_id as string, m.id as string]));
  const added = [...want].filter((id) => !have.has(id));
  const removed = [...have.keys()].filter((id) => !want.has(id));
  if (added.length) await svc.from('user_roles').insert(added.map((user_id) => ({ user_id, role: 'inactive' })));
  if (removed.length) await svc.from('user_roles').delete().in('id', removed.map((id) => have.get(id)!));
  if (added.length || removed.length) invalidate('board');   // the Team page shows an Inactive tag
  const name = cur ? quarterName(cur) : 'this quarter';
  await createNotifications(svc, [
    ...added.map((user_id) => ({ user_id, type: 'quarter_status', title: `You’re inactive for ${name}`, body: 'You keep your title. You have view-only access and aren’t expected at meetings.', href: '/portal?section=profile' })),
    ...removed.map((user_id) => ({ user_id, type: 'quarter_status', title: 'You’re active again', body: 'Meetings and your officer tools are back.', href: '/portal' })),
  ]);
  return { added, removed, quarter: cur ? quarterName(cur) : null };
}
