import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';

interface Params { params: Promise<{ id: string }>; }

// Looked up by the redemption scanner when an officer scans a member's
// redemption QR — shows what to hand over before they confirm.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'scan_redemptions')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { data: redemption } = await supabase
    .from('reward_redemptions')
    .select('id, status, point_cost, claimed_at, reward:reward_items(title, description), member:profiles!reward_redemptions_user_id_fkey(display_name)')
    .eq('id', id)
    .single();

  if (!redemption) return NextResponse.json({ error: 'Redemption not found — check the code.' }, { status: 404 });
  return NextResponse.json({ redemption });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'scan_redemptions')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc('confirm_redemption', { _redemption_id: id, _officer_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
