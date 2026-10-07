import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { withRole } from '@/lib/portal/roleGrant';
import { ASSIGNABLE_ROLES } from '@/types/database';
import type { AppRole } from '@/types/database';
import { strictUser } from '@/lib/supabase/localAuth';

interface BulkRoleInput {
  userIds: string[];
  role: AppRole;
  divisionId?: string | null;
}

// Adds one role grant to several users at once (e.g. onboarding a whole new
// officer cohort). Deliberately re-fetches each user's *current* roles here
// rather than trusting a client-sent snapshot — the client only has whatever
// it last loaded, which can be stale by the time this runs, and this
// endpoint can bypass RLS (service client) so it must be the one enforcing
// correctness. Merge semantics mirror RoleManager.tsx's single-user editor:
// a non-division role replaces any existing grant of that same role (the
// one-per-user cap); a division role is added alongside any the user
// already holds (someone can lead more than one division).
export async function POST(request: Request) {
  const userClient = await createClient();
  const { data: { user } } = await strictUser(userClient);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerRoles } = await userClient
    .from('user_roles')
    .select('role, division_id')
    .eq('user_id', user.id);

  if (!hasCapability(callerRoles ?? [], 'manage_roles')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { userIds, role, divisionId } = await request.json() as BulkRoleInput;
  if (!Array.isArray(userIds) || userIds.length === 0 || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Missing userIds or invalid role' }, { status: 400 });
  }
  if (role === 'division' && !divisionId) {
    return NextResponse.json({ error: 'A division must be selected for the division role' }, { status: 400 });
  }

  const adminClient = createServiceClient();
  const results = await Promise.all(userIds.map(async (userId) => {
    const { data: currentRoles } = await adminClient
      .from('user_roles')
      .select('role, division_id')
      .eq('user_id', userId);

    const nextRoles = withRole(currentRoles ?? [], role, divisionId ?? null);
    if (!nextRoles) return { userId, skipped: true };

    const { error } = await adminClient.rpc('admin_set_user_roles', {
      _user_id: userId,
      _roles: nextRoles,
      _granted_by: user.id,
    });
    return { userId, error: error?.message, roles: error ? undefined : nextRoles };
  }));

  const failed = results.filter((r) => r.error);
  if (failed.length > 0 && failed.length === results.length) {
    return NextResponse.json({ error: 'Failed to update any users', results }, { status: 500 });
  }

  const applied = results.filter((r) => !r.error && !('skipped' in r && r.skipped));
  if (applied.length > 0) {
    await logAudit(adminClient, { actorId: user.id, action: 'update', entityType: 'roles', summary: `Added ${role} to ${applied.length} account${applied.length === 1 ? '' : 's'} in bulk`, details: { role, divisionId: divisionId ?? null, userIds: applied.map((r) => r.userId) } });
  }
  return NextResponse.json({ ok: true, results });
}
