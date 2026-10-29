import type { SupabaseClient } from '@supabase/supabase-js';
import { withRole, type RoleRow } from '@/lib/portal/roleGrant';
import type { AppRole } from '@/types/database';

export const MAX_PASTED_EMAILS = 300;
const EMAIL = /[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/** Every email address in a pasted block, lowercase and without duplicates. Commas, semicolons, new lines, "Name <email>" and stray words all work. */
export function parseEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL) ?? []).map((e) => e.toLowerCase().replace(/[.']+$/, '')))];
}

export interface Matched {
  userId: string;
  email: string;
  name: string;
  hasRole: boolean;
}
export interface EmailPlan {
  matched: Matched[];
  notFound: string[]; // no account: these wait for their first sign-in
  alreadyQueued: string[]; // no account, and already waiting for this role
  ambiguous: { email: string; names: string[] }[]; // the address belongs to more than one account: skipped
}

/** Works out what a list of emails would do for one role, without changing anything. */
export async function planByEmail(svc: SupabaseClient, emails: string[], role: AppRole, divisionId: string | null): Promise<EmailPlan> {
  const { data: found } = await svc.rpc('find_users_by_emails', { _emails: emails });
  const owners = new Map<string, Set<string>>();
  for (const r of (found ?? []) as { user_id: string; email: string }[]) {
    const set = owners.get(r.email) ?? new Set<string>();
    set.add(r.user_id);
    owners.set(r.email, set);
  }
  const ids = [...new Set([...owners.values()].flatMap((s) => [...s]))];
  const [{ data: profiles }, { data: grants }] = ids.length
    ? await Promise.all([svc.from('profiles').select('id, display_name').in('id', ids), svc.from('user_roles').select('user_id, role, division_id').in('user_id', ids)])
    : [{ data: [] }, { data: [] }];
  const nameOf = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) || 'Unnamed']));
  const rolesOf = new Map<string, RoleRow[]>();
  for (const g of grants ?? [])
    rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), { role: g.role as string, division_id: g.division_id as string | null }]);

  const plan: EmailPlan = { matched: [], notFound: [], alreadyQueued: [], ambiguous: [] };
  const missing: string[] = [];
  for (const email of emails) {
    const set = owners.get(email);
    if (!set || set.size === 0) missing.push(email);
    else if (set.size > 1) plan.ambiguous.push({ email, names: [...set].map((id) => nameOf.get(id) ?? 'Unnamed') });
    else {
      const userId = [...set][0];
      plan.matched.push({ userId, email, name: nameOf.get(userId) ?? 'Unnamed', hasRole: withRole(rolesOf.get(userId) ?? [], role, divisionId) === null });
    }
  }
  if (missing.length) {
    let q = svc.from('pending_role_grants').select('email').in('email', missing).eq('role', role).gt('expires_at', new Date().toISOString());
    q = divisionId ? q.eq('division_id', divisionId) : q.is('division_id', null);
    const queued = new Set(((await q).data ?? []).map((r) => r.email as string));
    for (const e of missing) (queued.has(e) ? plan.alreadyQueued : plan.notFound).push(e);
  }
  return plan;
}

/** Waiting grants past their 90 days are never used, so they are deleted (run by the daily housekeeping job). */
export async function cleanupExpiredGrants(svc: SupabaseClient, now = new Date()): Promise<{ removed: number }> {
  const { count } = await svc.from('pending_role_grants').delete({ count: 'exact' }).lt('expires_at', now.toISOString());
  return { removed: count ?? 0 };
}

/** Gives a person every role that was waiting for one of their email addresses, then clears those entries. Called when they sign in or link an email.
 *  It never throws: a problem here must not get in the way of signing in. */
export async function applyPendingGrants(svc: SupabaseClient, userId: string, emails: string[]): Promise<number> {
  try {
    const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!clean.length) return 0;
    const { data: waiting } = await svc.from('pending_role_grants').select('id, role, division_id, created_by').in('email', clean).gt('expires_at', new Date().toISOString());
    let given = 0;
    for (const p of waiting ?? []) {
      const { data: current } = await svc.from('user_roles').select('role, division_id').eq('user_id', userId);
      const next = withRole((current ?? []) as RoleRow[], p.role as string, (p.division_id as string | null) ?? null);
      if (next) {
        const { error } = await svc.rpc('admin_set_user_roles', { _user_id: userId, _roles: next, _granted_by: p.created_by ?? null });
        if (error) continue; // keep it waiting; try again next sign-in
        given++;
      }
      await svc.from('pending_role_grants').delete().eq('id', p.id);
    }
    return given;
  } catch (e) {
    console.error('[pendingGrants] failed:', e);
    return 0;
  }
}
