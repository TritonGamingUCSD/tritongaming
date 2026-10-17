import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { withRole, type RoleRow } from '@/lib/portal/roleGrant';
import { ASSIGNABLE_ROLES } from '@/types/database';
import type { AppRole } from '@/types/database';
import { strictUser } from '@/lib/supabase/localAuth';
import { MAX_PASTED_EMAILS, parseEmails, planByEmail } from '@/lib/members/roleByEmail';

// Give one role to a pasted list of email addresses. `apply: false` only checks (who matches, who has no account yet, who already has the role);
// `apply: true` then gives the role to the matched people at once and leaves a waiting grant for every address without an account, which is
// applied the first time someone signs in or links that address (see applyPendingGrants). Admin only, like every role change.
export async function POST(request: Request) {
  const userClient = await createClient();
  const { data: { user } } = await strictUser(userClient);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: callerRoles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(callerRoles ?? [], 'manage_roles')) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const role = b.role as AppRole;
  const divisionId = role === 'division' ? String(b.divisionId ?? '') || null : null;
  if (!ASSIGNABLE_ROLES.includes(role)) return NextResponse.json({ error: 'Pick a role.' }, { status: 400 });
  if (role === 'division' && !divisionId) return NextResponse.json({ error: 'Pick a division for the division role.' }, { status: 400 });
  const emails = parseEmails(String(b.text ?? ''));
  if (emails.length === 0) return NextResponse.json({ error: 'No email addresses found in what you pasted.' }, { status: 400 });
  if (emails.length > MAX_PASTED_EMAILS) return NextResponse.json({ error: `That is ${emails.length} addresses. Paste up to ${MAX_PASTED_EMAILS} at a time.` }, { status: 400 });

  const svc = createServiceClient();
  const plan = await planByEmail(svc, emails, role, divisionId);
  if (!b.apply) return NextResponse.json({ ok: true, applied: false, total: emails.length, ...plan });

  // Give the role to everyone matched who does not have it. The current roles are read again here, never trusted from the check.
  const given: string[] = [];
  const failed: string[] = [];
  await Promise.all(plan.matched.filter((m) => !m.hasRole).map(async (m) => {
    const { data: current } = await svc.from('user_roles').select('role, division_id').eq('user_id', m.userId);
    const next = withRole((current ?? []) as RoleRow[], role, divisionId);
    if (!next) return;
    const { error } = await svc.rpc('admin_set_user_roles', { _user_id: m.userId, _roles: next, _granted_by: user.id });
    (error ? failed : given).push(m.email);
  }));

  // Addresses with no account yet wait for their first sign-in.
  let queued = 0;
  for (const email of plan.notFound) {
    const { error } = await svc.from('pending_role_grants').insert({ email, role, division_id: divisionId, created_by: user.id });
    if (!error) queued++;   // a duplicate (two pastes at once) is simply already waiting
  }

  await logAudit(svc, { actorId: user.id, action: 'update', entityType: 'roles', summary: `Added ${role} to ${given.length} account${given.length === 1 ? '' : 's'} from a pasted email list${queued ? ` and queued ${queued} address${queued === 1 ? '' : 'es'} for first sign-in` : ''}`, details: { role, divisionId, given: given.length, queued, alreadyHad: plan.matched.filter((m) => m.hasRole).length, ambiguous: plan.ambiguous.length, failed: failed.length } });
  return NextResponse.json({ ok: true, applied: true, total: emails.length, given: given.length, queued, alreadyHad: plan.matched.filter((m) => m.hasRole).length, alreadyQueued: plan.alreadyQueued.length, ambiguous: plan.ambiguous, failed });
}
