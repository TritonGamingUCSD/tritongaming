import { createClient } from '@/lib/supabase/server';
import { bucketByMonth, cumulative } from '@/lib/monthBuckets';

export interface DivisionCount { name: string; count: number; }

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

  const [eventsRes, ticketsRes, profilesRes, rolesRes, divisionsRes] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('status'),
    supabase.from('profiles').select('created_at'),
    supabase.from('user_roles').select('role, division_id'),
    supabase.from('divisions').select('id, name'),
  ]);

  const tickets = ticketsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const roleRows = rolesRes.data ?? [];
  const divisions = divisionsRes.data ?? [];

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

  return { memberGrowth, divisionSizes, totals };
}

export type StatsData = Awaited<ReturnType<typeof getStatsData>>;
