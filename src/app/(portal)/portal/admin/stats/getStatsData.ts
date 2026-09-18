import { createClient } from '@/lib/supabase/server';
import { PACIFIC_TZ } from '@/lib/timezone';

export interface MonthPoint { month: string; count: number; }
export interface EventTicketStat { title: string; issued: number; checkedIn: number; rate: number; startDate: string; }
export interface DivisionCount { name: string; count: number; }

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, month: 'short', year: '2-digit' });
// year/month only, in Pacific — used purely to derive a sortable "YYYY-MM"
// bucket key, not for display.
const MONTH_KEY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit' });

// Timestamps come back from Postgres as UTC ISO strings. Slicing the first 7
// characters reads the *UTC* year-month directly off the string — for a
// signup/event created in the last few hours of a UTC day (which is
// afternoon/evening the previous day in Pacific, since Pacific runs 7-8
// hours behind), that silently attributes it to the wrong month in the
// "per month" charts. Formatting through Intl with an explicit Pacific
// timeZone buckets it by the calendar month it actually falls in for this
// club's own timezone, not whatever UTC's clock happened to read.
function monthKey(iso: string): string {
  const parts = MONTH_KEY_FMT.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

function bucketByMonth(dates: string[]): MonthPoint[] {
  const counts = new Map<string, number>();
  dates.forEach((d) => {
    const key = monthKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    // Noon UTC, not midnight — a date-time string with no offset is parsed
    // as *local* time (the server process's own timezone, not necessarily
    // Pacific), so midnight there could format back to the previous day/
    // month once MONTH_FMT re-renders it in Pacific. Noon UTC lands in the
    // early morning of the same calendar day in Pacific (7-8 hours behind),
    // so it can never cross a month boundary when reformatted.
    .map(([key, count]) => ({ month: MONTH_FMT.format(new Date(`${key}-01T12:00:00Z`)), count }));
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
