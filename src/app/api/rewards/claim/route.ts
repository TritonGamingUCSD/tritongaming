import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getTier, fetchTiers } from '@/lib/members/tiers';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reward_id } = await request.json();
  if (!reward_id) return NextResponse.json({ error: 'Missing reward_id' }, { status: 400 });

  const serviceClient = createServiceClient();

  // The tier gate is enforced here, not inside claim_reward's SQL — tier
  // thresholds live in tier_definitions and are fetched fresh below, kept
  // out of SQL so this logic isn't duplicated between here and the DB.
  // Safe to do at this layer specifically because claim_reward is only
  // ever reachable through this route's service-role call, never directly
  // by a client.
  const { data: reward } = await serviceClient.from('reward_items').select('min_tier').eq('id', reward_id).single();
  if (reward?.min_tier) {
    const [{ data: transactions }, tiers] = await Promise.all([
      serviceClient.from('point_transactions').select('amount, reversed_at').eq('user_id', user.id),
      fetchTiers(serviceClient),
    ]);
    const lifetimeEarned = (transactions ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);
    const requiredIdx = tiers.findIndex((t) => t.name === reward.min_tier);
    const currentIdx = tiers.findIndex((t) => t.name === getTier(lifetimeEarned, tiers).name);
    if (requiredIdx !== -1 && currentIdx < requiredIdx) {
      return NextResponse.json({ error: `This reward requires ${reward.min_tier} tier or higher.` }, { status: 403 });
    }
  }

  // claim_reward is the atomicity boundary (balance check, debit, stock
  // decrement, redemption row — all or nothing), so this needs the
  // service-role client to call it even though the caller is just
  // spending their own points.
  const { data: redemptionId, error } = await serviceClient.rpc('claim_reward', {
    _user_id: user.id,
    _reward_id: reward_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ redemptionId });
}
