import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';

// The ring code on a member's reward pickup carries `r` and the first twelve hex digits of the redemption's id. Staff with access to reward pickups find the
// redemption from it here (the same details as looking it up by its whole id), then confirm it as before.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'scan_redemptions')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const p = (new URL(request.url).searchParams.get('p') ?? '').toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(p)) return NextResponse.json({ error: 'That isn’t a reward pickup code.' }, { status: 400 });
  const lo = `${p.slice(0, 8)}-${p.slice(8, 12)}-0000-0000-000000000000`, hi = `${p.slice(0, 8)}-${p.slice(8, 12)}-ffff-ffff-ffffffffffff`;
  const { data } = await createServiceClient()
    .from('reward_redemptions')
    .select('id, status, point_cost, claimed_at, reward:reward_items(title, description), member:profiles!reward_redemptions_user_id_fkey(display_name)')
    .gte('id', lo).lte('id', hi).limit(2);
  if (!data?.length) return NextResponse.json({ error: 'Reward not found — check the code.' }, { status: 404 });
  if (data.length > 1) return NextResponse.json({ error: 'That code matches more than one reward. Ask them to reopen it.' }, { status: 409 });
  return NextResponse.json({ redemption: data[0] });
}
