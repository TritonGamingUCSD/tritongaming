import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getTier, fetchTiers } from '@/lib/tiers';
import { isRewardsEligible, type RoleGrant } from '@/lib/capabilities';

// Every rewards-eligible member (see is_rewards_eligible — the same
// group that can actually earn points at all) is on this leaderboard,
// no opt-in. Exact points are always shown for everyone; the only choice
// left is anonymous vs. named (profiles.leaderboard_anonymous, default
// true). Ranking is still computed server-side from the real name before
// redaction, so someone appearing as "Anonymous" still occupies their
// real rank instead of the board silently reordering around them.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = createServiceClient();

  const [{ data: allRoles }, { data: profiles }, { data: allTransactions }, tiers] = await Promise.all([
    serviceClient.from('user_roles').select('user_id, role, division_id'),
    serviceClient.from('profiles').select('id, display_name, leaderboard_anonymous'),
    serviceClient.from('point_transactions').select('user_id, amount, reversed_at'),
    fetchTiers(supabase),
  ]);

  const rolesByUser = new Map<string, RoleGrant[]>();
  (allRoles ?? []).forEach((r) => {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push({ role: r.role, division_id: r.division_id });
    rolesByUser.set(r.user_id, list);
  });

  const lifetimeByUser = new Map<string, number>();
  (allTransactions ?? []).forEach((t) => {
    if (t.amount > 0 && !t.reversed_at) lifetimeByUser.set(t.user_id, (lifetimeByUser.get(t.user_id) ?? 0) + t.amount);
  });

  const ranked = (profiles ?? [])
    .filter((p) => isRewardsEligible(rolesByUser.get(p.id) ?? []))
    .map((p) => ({ ...p, lifetime: lifetimeByUser.get(p.id) ?? 0 }))
    .sort((a, b) => b.lifetime - a.lifetime)
    .map((p, i) => ({
      rank: i + 1,
      isSelf: p.id === user.id,
      name: p.leaderboard_anonymous ? 'Anonymous' : (p.display_name || 'A member'),
      tier: getTier(p.lifetime, tiers).name,
      points: p.lifetime,
    }));

  return NextResponse.json({ leaderboard: ranked });
}
