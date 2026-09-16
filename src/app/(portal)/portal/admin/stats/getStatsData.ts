import { createClient } from '@/lib/supabase/server';

export interface MonthPoint { month: string; count: number; }
export interface EventTicketStat { title: string; issued: number; checkedIn: number; rate: number; startDate: string; }
export interface DivisionCount { name: string; count: number; }

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function bucketByMonth(dates: string[]): MonthPoint[] {
  const counts = new Map<string, number>();
  dates.forEach((d) => {
    const key = monthKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ month: MONTH_FMT.format(new Date(`${key}-01T00:00:00`)), count }));
}

function cumulative(points: MonthPoint[]): MonthPoint[] {
  let running = 0;
  return points.map((p) => {
    running += p.count;
    return { month: p.month, count: running };
  });
}

// Analytics dashboard data — everything here is built from tables that
// already exist (events, tickets, profiles, user_roles, divisions), no new
// tracking infrastructure. "Website click" analytics was explicitly out of
// scope (no pageview/click tracking exists anywhere in the app yet).
export async function getStatsData() {
  const supabase = await createClient();

  const [eventsRes, ticketsRes, profilesRes, rolesRes, divisionsRes] = await Promise.all([
    supabase.from('events').select('id, title, start_date, created_at'),
    supabase.from('tickets').select('event_id, status, created_at'),
    supabase.from('profiles').select('created_at'),
    supabase.from('user_roles').select('role, division_id'),
    supabase.from('divisions').select('id, name'),
  ]);

  const events = eventsRes.data ?? [];
  const tickets = ticketsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const roleRows = rolesRes.data ?? [];
  const divisions = divisionsRes.data ?? [];

  const eventsPerMonth = bucketByMonth(events.map((e) => e.created_at));
  const ticketsPerMonth = bucketByMonth(tickets.map((t) => t.created_at));
  const memberGrowth = cumulative(bucketByMonth(profiles.map((p) => p.created_at)));

  const ticketsByEvent = new Map<string, { issued: number; checkedIn: number }>();
  tickets.forEach((t) => {
    const bucket = ticketsByEvent.get(t.event_id) ?? { issued: 0, checkedIn: 0 };
    if (t.status === 'active' || t.status === 'used') bucket.issued++;
    if (t.status === 'used') bucket.checkedIn++;
    ticketsByEvent.set(t.event_id, bucket);
  });
  // Ticket sales + attendance rate per event — the two numbers exec/admin
  // actually want to track, per explicit feedback over role distribution.
  const eventStats: EventTicketStat[] = events
    .map((e) => {
      const b = ticketsByEvent.get(e.id) ?? { issued: 0, checkedIn: 0 };
      return { title: e.title, issued: b.issued, checkedIn: b.checkedIn, rate: b.issued ? Math.round((b.checkedIn / b.issued) * 100) : 0, startDate: e.start_date };
    })
    .filter((e) => e.issued > 0)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 20)
    .reverse();

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
    events: events.length,
    ticketsIssued: tickets.filter((t) => t.status === 'active' || t.status === 'used').length,
    checkins: tickets.filter((t) => t.status === 'used').length,
  };

  return { eventsPerMonth, ticketsPerMonth, memberGrowth, eventStats, divisionSizes, totals };
}

export type StatsData = Awaited<ReturnType<typeof getStatsData>>;
