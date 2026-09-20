import { createClient } from '@/lib/supabase/server';
import { bucketByMonth } from '@/lib/monthBuckets';

export interface EventTicketStat { title: string; issued: number; checkedIn: number; rate: number; startDate: string; }

// Shared by the standalone /portal/events route and the portal hub.
export async function getEventsData() {
  const supabase = await createClient();
  const [{ data: events }, { data: tickets }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, start_date, created_at, location, is_published, requires_ticket, max_capacity, audience')
      .order('start_date', { ascending: false })
      .limit(50),
    supabase.from('tickets').select('event_id, status, created_at'),
  ]);

  const ticketsByEvent = new Map<string, { issued: number; checkedIn: number }>();
  (tickets ?? []).forEach((t) => {
    const bucket = ticketsByEvent.get(t.event_id) ?? { issued: 0, checkedIn: 0 };
    if (t.status === 'active' || t.status === 'used') bucket.issued++;
    if (t.status === 'used') bucket.checkedIn++;
    ticketsByEvent.set(t.event_id, bucket);
  });

  const eventsWithTickets = (events ?? []).map((e) => ({
    ...e,
    ticketsIssued: ticketsByEvent.get(e.id)?.issued ?? 0,
    ticketsCheckedIn: ticketsByEvent.get(e.id)?.checkedIn ?? 0,
  }));

  // Analytics-tab data — moved here from the Admin card's Analytics tab
  // (see getStatsData.ts), since these are all per-event/event-entity
  // numbers, not org-wide platform metrics.
  const eventsPerMonth = bucketByMonth((events ?? []).map((e) => e.created_at));
  const ticketsPerMonth = bucketByMonth((tickets ?? []).map((t) => t.created_at));
  const eventStats: EventTicketStat[] = (events ?? [])
    .map((e) => {
      const b = ticketsByEvent.get(e.id) ?? { issued: 0, checkedIn: 0 };
      return { title: e.title, issued: b.issued, checkedIn: b.checkedIn, rate: b.issued ? Math.round((b.checkedIn / b.issued) * 100) : 0, startDate: e.start_date };
    })
    .filter((e) => e.issued > 0)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 20)
    .reverse();

  return { events: eventsWithTickets, eventsPerMonth, ticketsPerMonth, eventStats };
}
