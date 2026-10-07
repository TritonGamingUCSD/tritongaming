import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { ASSIGNABLE_ROLES } from '@/types/database';
import type { AppRole } from '@/types/database';
import { strictUser } from '@/lib/supabase/localAuth';

interface RoleInput {
  role: AppRole;
  division_id?: string | null;
}

export async function PUT(request: Request) {
  // 1. Verify the caller is an admin via the user's session
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

  // 2. Parse and validate the body — a full replacement of the target user's role set
  const { userId, roles } = await request.json() as { userId: string; roles: RoleInput[] };
  if (!userId || !Array.isArray(roles)) {
    return NextResponse.json({ error: 'Missing userId or roles' }, { status: 400 });
  }
  for (const r of roles) {
    if (!ASSIGNABLE_ROLES.includes(r.role)) {
      return NextResponse.json({ error: `Invalid role: ${r.role}` }, { status: 400 });
    }
    if (r.role === 'division' && !r.division_id) {
      return NextResponse.json({ error: 'A division must be selected for the division role' }, { status: 400 });
    }
  }

  // 3. Apply atomically via the service-role RPC (bypasses RLS; auth already verified above)
  const adminClient = createServiceClient();
  const { error } = await adminClient.rpc('admin_set_user_roles', {
    _user_id: userId,
    _roles: roles,
    _granted_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: target } = await adminClient.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  await logAudit(adminClient, { actorId: user.id, action: 'update', entityType: 'roles', entityId: userId, summary: `Roles for "${target?.display_name ?? 'someone'}" set to ${roles.length ? roles.map((r) => r.role).join(', ') : 'none'}`, details: { roles } });
  return NextResponse.json({ ok: true });
}
