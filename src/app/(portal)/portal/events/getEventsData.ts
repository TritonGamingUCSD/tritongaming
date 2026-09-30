import { createClient } from '@/lib/supabase/server';
import { bucketByMonth } from '@/lib/monthBuckets';
import { buildCheckinFormUrl, type CheckinFormConfig } from '@/lib/checkinForm';

export interface EventTicketStat { title: string; issued: number; checkedIn: number; rate: number; startDate: string; }

// Shared by the standalone /portal/events route and the portal hub.
export async function getEventsData() {
  const supabase = await createClient();
  const [{ data: events }, { data: tickets }, { data: formSettings }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, start_date, created_at, location, is_published, requires_ticket, max_capacity, audience, points_value, requires_checkin_form, checkin_food_item, checkin_form_event_name, checkin_form_override')
      .order('start_date', { ascending: false })
      .limit(50),
    supabase.from('tickets').select('event_id, status, created_at'),
    supabase.from('checkin_form_settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  const ticketsByEvent = new Map<string, { issued: number; checkedIn: number }>();
  (tickets ?? []).forEach((t) => {
    const bucket = ticketsByEvent.get(t.event_id) ?? { issued: 0, checkedIn: 0 };
    if (t.status === 'active' || t.status === 'used') bucket.issued++;
    if (t.status === 'used') bucket.checkedIn++;
    ticketsByEvent.set(t.event_id, bucket);
  });

  // Admin-facing preview link, not tied to any specific attendee — uses a
  // representative sample year/role rather than a real person's, since
  // this is just "does the mapping work," the same thing the Check-In
  // Form settings panel's own "Test It" section is for, just reachable
  // straight from the events list/editor instead of a separate tab.
  const eventsWithTickets = (events ?? []).map((e) => {
    const config = (e.checkin_form_override as CheckinFormConfig | null) ?? formSettings;
    const checkinFormPreviewUrl = e.requires_checkin_form && config
      ? buildCheckinFormUrl(config, {
          eventTitle: e.checkin_form_event_name?.trim() || e.title,
          year: '1st Year',
          roles: ['ucsd'],
          foodItem: e.checkin_food_item ?? null,
        })
      : null;
    return {
      ...e,
      ticketsIssued: ticketsByEvent.get(e.id)?.issued ?? 0,
      ticketsCheckedIn: ticketsByEvent.get(e.id)?.checkedIn ?? 0,
      checkinFormPreviewUrl,
    };
  });

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

// The UCSD check-in form config — see checkin_form_settings migration.
// Lives in event management, not Site Content, since it's operational
// config for the check-in flow rather than public copy. Only fetched for
// manage_events holders (the Check-In Form tab is gated the same way in
// EventsSectionContent) — everyone else's own prefill URL is still built
// fine without this, from getTicketsData's own separate read of the table.
export async function getCheckinFormSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from('checkin_form_settings').select('*').eq('id', 1).maybeSingle();
  return data ?? undefined;
}
