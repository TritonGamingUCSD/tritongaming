import { createClient } from '@/lib/supabase/server';

// Shared by the standalone /portal/events route and the portal hub.
export async function getEventsData() {
  const supabase = await createClient();
  const [{ data: events }, { data: tickets }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, start_date, location, is_published, requires_ticket, max_capacity')
      .order('start_date', { ascending: false })
      .limit(50),
    supabase.from('tickets').select('event_id, status'),
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

  return { events: eventsWithTickets };
}
