import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasRole } from '@/types/database';
import type { UserRole } from '@/types/database';

const VALID_ROLES: UserRole[] = ['guest', 'member', 'division', 'lead', 'officer', 'exec', 'admin'];

export async function PATCH(request: Request) {
  // 1. Verify the caller is an admin via the user's session
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!callerProfile || !hasRole(callerProfile.role as UserRole, 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // 2. Parse and validate the body
  const { userId, role } = await request.json() as { userId: string; role: string };
  if (!userId || !role) {
    return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  // 3. Apply the update with the service-role client (bypasses RLS)
  const adminClient = createServiceClient();
  const { error } = await adminClient
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
