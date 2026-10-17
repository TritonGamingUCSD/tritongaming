import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { strictUser } from '@/lib/supabase/localAuth';

async function admin() {
  const userClient = await createClient();
  const { data: { user } } = await strictUser(userClient);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: callerRoles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(callerRoles ?? [], 'manage_roles')) return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { user, svc: createServiceClient() };
}

// The roles still waiting for someone's first sign-in (expired ones are not listed).
export async function GET() {
  const a = await admin(); if (a.error) return a.error;
  const { data } = await a.svc.from('pending_role_grants').select('id, email, role, division_id, created_at, expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(500);
  return NextResponse.json({ pending: data ?? [] });
}

// Take one waiting grant back (a typo, or someone who is not joining after all).
export async function DELETE(request: Request) {
  const a = await admin(); if (a.error) return a.error;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { data } = await a.svc.from('pending_role_grants').delete().eq('id', id).select('email, role').maybeSingle();
  if (data) await logAudit(a.svc, { actorId: a.user.id, action: 'delete', entityType: 'roles', summary: `Removed the waiting ${data.role} role for ${data.email}` });
  return NextResponse.json({ ok: true });
}
