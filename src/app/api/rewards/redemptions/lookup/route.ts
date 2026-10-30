import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';

// The TGcode on a member's reward pickup carries `r` and the first 8 hex digits (12 in the first format) of the redemption's id. Staff with access to reward pickups find the
// redemption from it here (the same details as looking it up by its whole id), then confirm it as before.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'scan_redemptions')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const p = (new URL(request.url).searchParams.get('p') ?? '').toLowerCase();
  if (!/^([0-9a-f]{7,8}|[0-9a-f]{12})$/.test(p)) return NextResponse.json({ error: 'That isn’t a reward pickup code.' }, { status: 400 });
  // The code carries the first 8 hex digits of the id (7 in a Bytecode, 12 in the first format): every id that starts that way lies between these two.
  const head = p.length < 12 ? p : `${p.slice(0, 8)}-${p.slice(8, 12)}`;
  const lo = p.length < 12 ? `${head}${'0'.repeat(8 - p.length)}-0000-0000-0000-000000000000` : `${head}-0000-0000-000000000000`,
    hi = p.length < 12 ? `${head}${'f'.repeat(8 - p.length)}-ffff-ffff-ffff-ffffffffffff` : `${head}-ffff-ffff-ffffffffffff`;
  const { data } = await createServiceClient()
    .from('reward_redemptions')
    .select('id, status, point_cost, claimed_at, reward:reward_items(title, description), member:profiles!reward_redemptions_user_id_fkey(display_name)')
    .gte('id', lo)
    .lte('id', hi)
    .limit(2);
  if (!data?.length) return NextResponse.json({ error: 'Reward not found — check the code.' }, { status: 404 });
  if (data.length > 1) return NextResponse.json({ error: 'That code matches more than one reward. Ask them to reopen it.' }, { status: 409 });
  return NextResponse.json({ redemption: data[0] });
}
