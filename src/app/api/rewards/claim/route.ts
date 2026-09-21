import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getTier, TIERS } from '@/lib/tiers';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reward_id } = await request.json();
  if (!reward_id) return NextResponse.json({ error: 'Missing reward_id' }, { status: 400 });

  const serviceClient = createServiceClient();

  // The tier gate is enforced here, not inside claim_reward's SQL — see
  // the min_tier migration for why (keeps tier thresholds defined in one
  // place, src/lib/tiers.ts, instead of duplicated into SQL). Safe to do
  // at this layer specifically because claim_reward is only ever
  // reachable through this route's service-role call, never directly by
  // a client.
  const { data: reward } = await serviceClient.from('reward_items').select('min_tier').eq('id', reward_id).single();
  if (reward?.min_tier) {
    const { data: transactions } = await serviceClient.from('point_transactions').select('amount, reversed_at').eq('user_id', user.id);
    const lifetimeEarned = (transactions ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);
    const requiredIdx = TIERS.findIndex((t) => t.name === reward.min_tier);
    const currentIdx = TIERS.findIndex((t) => t.name === getTier(lifetimeEarned).name);
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
