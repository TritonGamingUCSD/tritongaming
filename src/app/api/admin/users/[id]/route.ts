import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

interface Params { params: Promise<{ id: string }>; }

// Deletes an account outright, or — if `reassign_to` is given — merges it
// into another account first (e.g. someone who accidentally signed up
// twice: once with a personal Gmail, once with their @ucsd.edu Google
// account, before discovering LinkGoogleSection). See admin_delete_account
// in 20260922020000_add_admin_delete_account.sql for exactly what moves,
// what gets nulled, and what's protected (can't delete yourself through
// this, can't delete the last remaining admin outright).
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reassignTo = typeof body.reassign_to === 'string' && body.reassign_to ? body.reassign_to : null;

  const serviceClient = createServiceClient();
  const { error: rpcError } = await serviceClient.rpc('admin_delete_account', {
    _user_id: id,
    _admin_id: user.id,
    _reassign_to: reassignTo,
  });
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 400 });

  // The RPC only removes the public.profiles row (and everything that
  // cascades/reassigns from it) — the actual auth account (auth.users,
  // its identities, sessions) only goes away through the Admin API.
  const { error: authError } = await serviceClient.auth.admin.deleteUser(id);
  if (authError) return NextResponse.json({ error: `Account data was removed, but deleting the login itself failed: ${authError.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}
