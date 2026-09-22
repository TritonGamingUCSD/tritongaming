import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { bucketByMonth, cumulative } from '@/lib/monthBuckets';

export interface DivisionCount { name: string; count: number; }
export interface EconomyStats { inCirculation: number; totalRedeemed: number; pendingRedemptions: number; }
export interface TopReward { title: string; count: number; system: 'Rewards' | 'Battlepass'; }

// Analytics dashboard data — everything here is built from tables that
// already exist (events, tickets, profiles, user_roles, divisions), no new
// tracking infrastructure. "Website click" analytics was explicitly out of
// scope (no pageview/click tracking exists anywhere in the app yet).
// Per-event ticket/attendance breakdowns and events/tickets-per-month
// trends used to live here too — moved to the Events card's own Analytics
// tab (see getEventsData.ts), since they're event data, not an org-wide
// platform metric the way member growth and division sizes are.
export async function getStatsData() {
  const supabase = await createClient();
  // Points/Battlepass ledgers and redemptions are RLS-scoped to "your own
  // rows or has_capability(...)" — narrower than the public-ish reads
  // above, so these use the service client rather than assume admin reads
  // are covered by every one of those policies.
  const serviceClient = createServiceClient();

  const [eventsRes, ticketsRes, profilesRes, rolesRes, divisionsRes,
    memberPointsRes, officerPointsRes, memberRedemptionsRes, officerRedemptionsRes] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('status'),
    supabase.from('profiles').select('created_at'),
    supabase.from('user_roles').select('role, division_id'),
    supabase.from('divisions').select('id, name'),
    serviceClient.from('point_transactions').select('amount, type, reversed_at'),
    serviceClient.from('officer_point_transactions').select('amount, type, reversed_at'),
    serviceClient.from('reward_redemptions').select('status, reward:reward_items(title)').neq('status', 'cancelled'),
    serviceClient.from('officer_reward_redemptions').select('status, reward:officer_reward_items(title)').neq('status', 'cancelled'),
  ]);

  const tickets = ticketsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const roleRows = rolesRes.data ?? [];
  const divisions = divisionsRes.data ?? [];

  function summarizeEconomy(
    txns: { amount: number; type: string; reversed_at: string | null }[],
    redemptions: { status: string }[],
  ): EconomyStats {
    return {
      inCirculation: txns.reduce((sum, t) => sum + t.amount, 0),
      totalRedeemed: txns
        .filter((t) => t.type === 'redemption' && t.reversed_at === null && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      pendingRedemptions: redemptions.filter((r) => r.status === 'pending').length,
    };
  }
  const pointsEconomy = summarizeEconomy(memberPointsRes.data ?? [], memberRedemptionsRes.data ?? []);
  const battlepassEconomy = summarizeEconomy(officerPointsRes.data ?? [], officerRedemptionsRes.data ?? []);

  function topRewardsFrom(rows: { reward: { title: string } | { title: string }[] | null }[] | null, system: TopReward['system']) {
    const counts = new Map<string, number>();
    (rows ?? []).forEach((r) => {
      const title = (Array.isArray(r.reward) ? r.reward[0]?.title : r.reward?.title) ?? null;
      if (!title) return;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    });
    return [...counts.entries()].map(([title, count]) => ({ title, count, system }));
  }
  const topRewards: TopReward[] = [
    ...topRewardsFrom(memberRedemptionsRes.data, 'Rewards'),
    ...topRewardsFrom(officerRedemptionsRes.data, 'Battlepass'),
  ].sort((a, b) => b.count - a.count).slice(0, 6);

  const memberGrowth = cumulative(bucketByMonth(profiles.map((p) => p.created_at)));

  const divisionCounts = new Map<string, number>();
  roleRows.forEach((r) => {
    if (r.role === 'division' && r.division_id) {
      divisionCounts.set(r.division_id, (divisionCounts.get(r.division_id) ?? 0) + 1);
    }
  });
  const divisionSizes: DivisionCount[] = divisions
    .map((d) => ({ name: d.name, count: divisionCounts.get(d.id) ?? 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  const totals = {
    members: profiles.length,
    events: eventsRes.count ?? 0,
    ticketsIssued: tickets.filter((t) => t.status === 'active' || t.status === 'used').length,
    checkins: tickets.filter((t) => t.status === 'used').length,
  };

  return { memberGrowth, divisionSizes, totals, pointsEconomy, battlepassEconomy, topRewards };
}

export type StatsData = Awaited<ReturnType<typeof getStatsData>>;
