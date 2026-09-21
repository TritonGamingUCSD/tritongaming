import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficerTier, BATTLEPASS_ROLES } from '@/lib/officerTiers';

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

  const [{ data: items }, { data: transactions }, { data: pending }] = await Promise.all([
    supabase.from('officer_reward_items').select('id, title, description, point_cost, stock, min_tier, active').eq('active', true).order('point_cost'),
    supabase.from('officer_point_transactions').select('amount, reversed_at').eq('user_id', user.id),
    supabase
      .from('officer_reward_redemptions')
      .select('id, reward_id, status, point_cost, claimed_at, reward:officer_reward_items(title)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('claimed_at', { ascending: false }),
  ]);

  const balance = (transactions ?? []).reduce((sum, t) => sum + t.amount, 0);
  const lifetimeEarned = (transactions ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);

  return NextResponse.json({
    items: items ?? [],
    balance,
    lifetimeEarned,
    tier: getOfficerTier(lifetimeEarned).name,
    pending: pending ?? [],
  });
}
