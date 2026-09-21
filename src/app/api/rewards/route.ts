import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTier, TIERS } from '@/lib/tiers';

// Powers the "Shop" and "To Claim" tabs of the Rewards card — active
// items, the caller's own spendable balance + tier (so the UI can show a
// locked state for tier-gated items without a second round trip), their
// own pending (not-yet-fulfilled) redemptions (each still carries its QR
// to show an officer), and separately the tier-unlock rewards (free,
// one-per-user, min_tier-gated — see 20260921110000_allow_free_tier_unlock_rewards.sql)
// with each one's own claimed/unlocked state already resolved server-side.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: allActive }, { data: transactions }, { data: pending }, { data: myRedemptions }] = await Promise.all([
    supabase.from('reward_items').select('id, title, description, point_cost, stock, min_tier, active, reward_type').eq('active', true).order('point_cost'),
    supabase.from('point_transactions').select('amount, reversed_at').eq('user_id', user.id),
    supabase
      .from('reward_redemptions')
      .select('id, reward_id, status, point_cost, claimed_at, reward:reward_items(title)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('claimed_at', { ascending: false }),
    supabase.from('reward_redemptions').select('reward_id').eq('user_id', user.id).in('status', ['pending', 'fulfilled']),
  ]);

  const balance = (transactions ?? []).reduce((sum, t) => sum + t.amount, 0);
  // A reversed award doesn't count toward tier — see getMyPointsData.ts.
  const lifetimeEarned = (transactions ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);
  const tier = getTier(lifetimeEarned);
  const tierIdx = TIERS.findIndex((t) => t.name === tier.name);

  const claimedIds = new Set((myRedemptions ?? []).map((r) => r.reward_id));
  const tierRankOf = (name: string | null) => (name ? TIERS.findIndex((t) => t.name === name) : 0);
  // Ordered by tier requirement first (what you need to even see it as
  // reachable), then by cost within that tier — a flat cost-only order put
  // a cheap Platinum-gated item ahead of an expensive one anyone can
  // afford right now, which read as arbitrary.
  const items = (allActive ?? [])
    .filter((r) => r.point_cost > 0)
    .sort((a, b) => tierRankOf(a.min_tier) - tierRankOf(b.min_tier) || a.point_cost - b.point_cost);
  const unlocks = (allActive ?? [])
    .filter((r) => r.point_cost === 0)
    .map((r) => ({
      id: r.id, title: r.title, description: r.description, min_tier: r.min_tier,
      unlocked: tierRankOf(r.min_tier) <= tierIdx,
      claimed: claimedIds.has(r.id),
    }))
    .sort((a, b) => tierRankOf(a.min_tier) - tierRankOf(b.min_tier));

  return NextResponse.json({ items, unlocks, balance, tier: tier.name, pending: pending ?? [] });
}
