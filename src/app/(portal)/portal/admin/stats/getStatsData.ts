import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { bucketByMonth, cumulative, monthLabels } from '@/lib/events/monthBuckets';
import { fetchTiers } from '@/lib/members/tiers';
import { dailyCounts, retentionCohorts, tierBuckets, weekdayHourCounts, type Daily } from '@/lib/stats/analytics';
import { pacificDayKey } from '@/lib/core/timezone';

export interface DivisionCompare {
  name: string;
  members: number;
  events: number;
  checkins: number;
}
export interface DivisionCount {
  name: string;
  count: number;
}
export interface RoleCount {
  role: string;
  count: number;
}
export interface EconomyStats {
  inCirculation: number;
  totalRedeemed: number;
  pendingRedemptions: number;
}
export interface TopReward {
  title: string;
  count: number;
  system: 'Rewards';
}

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
  // Points ledgers and redemptions are RLS-scoped to "your own
  // rows or has_capability(...)" — narrower than the public-ish reads
  // above, so these use the service client rather than assume admin reads
  // are covered by every one of those policies.
  const serviceClient = createServiceClient();

  const [eventsRes, ticketsRes, profilesRes, rolesRes, divisionsRes, memberPointsRes, memberRedemptionsRes, eventRowsRes, cohostRes, tiers] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('status, created_at, checked_in_at, user_id, event_id'),
    supabase.from('profiles').select('created_at'),
    supabase.from('user_roles').select('role, division_id'),
    supabase.from('divisions').select('id, name'),
    serviceClient.from('point_transactions').select('amount, type, reversed_at, user_id'),
    serviceClient.from('reward_redemptions').select('status, reward:reward_items(title)').neq('status', 'cancelled'),
    supabase.from('events').select('id, division_id, start_date, is_published'),
    serviceClient.from('event_cohosts').select('event_id, division_id').eq('status', 'accepted'),
    fetchTiers(supabase).catch(() => []),
  ]);

  const tickets = ticketsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const roleRows = rolesRes.data ?? [];
  const divisions = divisionsRes.data ?? [];

  function summarizeEconomy(txns: { amount: number; type: string; reversed_at: string | null }[], redemptions: { status: string }[]): EconomyStats {
    return {
      inCirculation: txns.reduce((sum, t) => sum + t.amount, 0),
      totalRedeemed: txns.filter((t) => t.type === 'redemption' && t.reversed_at === null && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
      pendingRedemptions: redemptions.filter((r) => r.status === 'pending').length,
    };
  }
  const pointsEconomy = summarizeEconomy(memberPointsRes.data ?? [], memberRedemptionsRes.data ?? []);

  function topRewardsFrom(rows: { reward: { title: string } | { title: string }[] | null }[] | null, system: TopReward['system']) {
    const counts = new Map<string, number>();
    (rows ?? []).forEach((r) => {
      const title = (Array.isArray(r.reward) ? r.reward[0]?.title : r.reward?.title) ?? null;
      if (!title) return;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    });
    return [...counts.entries()].map(([title, count]) => ({ title, count, system }));
  }
  const topRewards: TopReward[] = [...topRewardsFrom(memberRedemptionsRes.data, 'Rewards')].sort((a, b) => b.count - a.count).slice(0, 6);

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

  // Tickets taken and people actually checked in, per month: how much of the interest turns into attendance.
  const issued = tickets.filter((t) => t.status === 'active' || t.status === 'used');
  const ticketsByMonth = bucketByMonth(issued.map((t) => t.created_at as string));
  const checkinsByMonth = bucketByMonth(tickets.filter((t) => t.checked_in_at).map((t) => t.checked_in_at as string));
  const monthKeys = [...new Set([...ticketsByMonth, ...checkinsByMonth].map((p) => p.key))].sort();
  const names = monthLabels(monthKeys);
  const activity = monthKeys.map((key) => ({
    month: names.get(key) ?? key,
    tickets: ticketsByMonth.find((p) => p.key === key)?.count ?? 0,
    checkins: checkinsByMonth.find((p) => p.key === key)?.count ?? 0,
  }));

  const roleTotals = new Map<string, number>();
  roleRows.forEach((r) => roleTotals.set(r.role, (roleTotals.get(r.role) ?? 0) + 1));
  const roleCounts: RoleCount[] = [...roleTotals.entries()].map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count);

  // The same three series day by day, so the charts can be read by day, week or month over any range.
  const daily: { members: Daily; tickets: Daily; checkins: Daily } = {
    members: dailyCounts(profiles.map((p) => p.created_at as string)),
    tickets: dailyCounts(issued.map((t) => t.created_at as string)),
    checkins: dailyCounts(tickets.filter((t) => t.checked_in_at).map((t) => t.checked_in_at as string)),
  };

  const monthAgo = Date.now() - 30 * 86_400_000;
  const newMembers = profiles.filter((p) => new Date(p.created_at as string).getTime() >= monthAgo).length;

  const totals = {
    members: profiles.length,
    newMembers,
    events: eventsRes.count ?? 0,
    ticketsIssued: tickets.filter((t) => t.status === 'active' || t.status === 'used').length,
    checkins: tickets.filter((t) => t.status === 'used').length,
  };

  // When people come: the busiest weekday and hour, every day of the last year, and who comes back month after month.
  const checkinTimes = tickets.filter((t) => t.checked_in_at).map((t) => t.checked_in_at as string);
  const hours = Array.from({ length: 16 }, (_, i) => i + 8); // 8 am to 11 pm
  const busiest = { hours, data: weekdayHourCounts(checkinTimes, hours) };
  const yearAgo = pacificDayKey(Date.now() - 364 * 86_400_000);
  const calendar = { from: yearAgo, to: pacificDayKey(), data: dailyCounts(checkinTimes).filter((d) => d[0] >= yearAgo) };
  const cohorts = retentionCohorts(
    tickets.filter((t) => t.checked_in_at && t.user_id).map((t) => ({ user: t.user_id as string, at: t.checked_in_at as string })),
    new Date(),
  );

  // How many people sit in each rewards tier, by what they have earned over all time.
  const lifetime = new Map<string, number>();
  (memberPointsRes.data ?? []).forEach((t) => {
    if (t.amount > 0 && !t.reversed_at && t.user_id) lifetime.set(t.user_id as string, (lifetime.get(t.user_id as string) ?? 0) + t.amount);
  });
  const tierSplit = tiers.length
    ? tierBuckets(
        [...lifetime.values()],
        tiers.map((t) => ({ name: t.name, min: t.min })),
      )
    : [];

  // Each division side by side: who is in it, the events it held (its own and ones it co-hosted) and the people it checked in.
  const eventRows = eventRowsRes.data ?? [];
  const cohostRows = cohostRes.data ?? [];
  const usedByEvent = new Map<string, number>();
  tickets.forEach((t) => {
    if (t.status === 'used') usedByEvent.set(t.event_id as string, (usedByEvent.get(t.event_id as string) ?? 0) + 1);
  });
  const nowMs = Date.now();
  const divisionCompare: DivisionCompare[] = divisions
    .map((d) => {
      const own = eventRows.filter((e) => e.division_id === d.id);
      const co = cohostRows
        .filter((c) => c.division_id === d.id)
        .map((c) => eventRows.find((e) => e.id === c.event_id))
        .filter(Boolean) as typeof eventRows;
      const held = [...own, ...co].filter((e) => e.is_published && new Date(e.start_date as string).getTime() <= nowMs);
      return {
        name: d.name,
        members: roleRows.filter((r) => r.division_id === d.id && (r.role === 'division' || r.role === 'division_member')).length,
        events: held.length,
        checkins: held.reduce((n, e) => n + (usedByEvent.get(e.id as string) ?? 0), 0),
      };
    })
    .filter((d) => d.members + d.events > 0)
    .sort((a, b) => b.checkins - a.checkins || b.members - a.members);

  return { daily, memberGrowth, divisionSizes, totals, pointsEconomy, topRewards, activity, roleCounts, busiest, calendar, cohorts, tierSplit, divisionCompare };
}

export type StatsData = Awaited<ReturnType<typeof getStatsData>>;
