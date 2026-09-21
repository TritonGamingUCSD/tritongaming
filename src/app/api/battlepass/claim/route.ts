import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getOfficerTier, OFFICER_TIERS } from '@/lib/officerTiers';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reward_id } = await request.json();
  if (!reward_id) return NextResponse.json({ error: 'Missing reward_id' }, { status: 400 });

  const serviceClient = createServiceClient();

  // Same tier-gate-in-TS pattern as /api/rewards/claim — see that route's
  // comment for why (keeps tier thresholds in one place, only reachable
  // through this service-role-backed route).
  const { data: reward } = await serviceClient.from('officer_reward_items').select('min_tier').eq('id', reward_id).single();
  if (reward?.min_tier) {
    const { data: transactions } = await serviceClient.from('officer_point_transactions').select('amount, reversed_at').eq('user_id', user.id);
    const lifetimeEarned = (transactions ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);
    const requiredIdx = OFFICER_TIERS.findIndex((t) => t.name === reward.min_tier);
    const currentIdx = OFFICER_TIERS.findIndex((t) => t.name === getOfficerTier(lifetimeEarned).name);
    if (requiredIdx !== -1 && currentIdx < requiredIdx) {
      return NextResponse.json({ error: `This reward requires ${reward.min_tier} tier or higher.` }, { status: 403 });
    }
  }

  const { data: redemptionId, error } = await serviceClient.rpc('claim_officer_reward', {
    _user_id: user.id,
    _reward_id: reward_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ redemptionId });
}
