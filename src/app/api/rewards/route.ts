import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTier } from '@/lib/tiers';

// Powers the "Shop" tab of the Rewards card — active items, the caller's
// own spendable balance + tier (so the UI can show a locked state for
// tier-gated items without a second round trip), and their own pending
// (not-yet-fulfilled) redemptions (each still carries its QR to show an
// officer).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: items }, { data: transactions }, { data: pending }] = await Promise.all([
    supabase.from('reward_items').select('id, title, description, point_cost, stock, min_tier, active').eq('active', true).order('point_cost'),
    supabase.from('point_transactions').select('amount, reversed_at').eq('user_id', user.id),
    supabase
      .from('reward_redemptions')
      .select('id, reward_id, status, point_cost, claimed_at, reward:reward_items(title)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('claimed_at', { ascending: false }),
  ]);

  const balance = (transactions ?? []).reduce((sum, t) => sum + t.amount, 0);
  // A reversed award doesn't count toward tier — see getMyPointsData.ts.
  const lifetimeEarned = (transactions ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);

  return NextResponse.json({ items: items ?? [], balance, tier: getTier(lifetimeEarned).name, pending: pending ?? [] });
}
