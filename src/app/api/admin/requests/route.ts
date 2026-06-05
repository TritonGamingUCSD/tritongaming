import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasRole } from '@/types/database';
import type { UserRole } from '@/types/database';

export async function PATCH(request: Request) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single();

  if (!profile || !hasRole(profile.role as UserRole, 'exec')) {
    return NextResponse.json({ error: 'Exec access required' }, { status: 403 });
  }

  const { requestId, status } = await request.json() as { requestId: string; status: 'approved' | 'rejected' };
  if (!requestId || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const adminClient = createServiceClient();
  const { error } = await adminClient
    .from('member_requests')
    .update({ status, reviewed_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
