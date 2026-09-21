import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficerTier, BATTLEPASS_ROLES, fetchOfficerTiers } from '@/lib/officerTiers';

// Powers the officer-facing "Battlepass" hub card — same shape as
// /api/rewards, but entirely against the officer_* tables (see
// 20260921100000_add_officer_points_system.sql for why this is a fully
// separate ledger/shop/tier set rather than reusing the member one; the
// tables/functions keep their original officer_* names in the schema —
// "Battlepass" is the user-facing name only).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  if (!(roles ?? []).some((r) => BATTLEPASS_ROLES.includes(r.role))) {
    return NextResponse.json({ error: 'The Battlepass is only for officer-tier roles.' }, { status: 403 });
  }

  const [{ data: allActive }, { data: transactions }, { data: pending }, { data: myRedemptions }, tiers] = await Promise.all([
    supabase.from('officer_reward_items').select('id, title, description, point_cost, stock, min_tier, active, reward_type').eq('active', true).order('point_cost'),
    supabase.from('officer_point_transactions').select('amount, reversed_at').eq('user_id', user.id),
    supabase
      .from('officer_reward_redemptions')
      .select('id, reward_id, status, point_cost, claimed_at, reward:officer_reward_items(title)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('claimed_at', { ascending: false }),
    supabase.from('officer_reward_redemptions').select('reward_id').eq('user_id', user.id).in('status', ['pending', 'fulfilled']),
    fetchOfficerTiers(supabase),
  ]);

  const balance = (transactions ?? []).reduce((sum, t) => sum + t.amount, 0);
  const lifetimeEarned = (transactions ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);
  const tier = getOfficerTier(lifetimeEarned, tiers);
  const tierIdx = tiers.findIndex((t) => t.name === tier.name);

  const claimedIds = new Set((myRedemptions ?? []).map((r) => r.reward_id));
  const tierRankOf = (name: string | null) => (name ? tiers.findIndex((t) => t.name === name) : 0);
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

  return NextResponse.json({
    items,
    unlocks,
    balance,
    lifetimeEarned,
    tier: tier.name,
    pending: pending ?? [],
  });
}
