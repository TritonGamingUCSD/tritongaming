import { cleanTheme } from '@/lib/events/eventTheme';
import { createServiceClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { bucketByMonth } from '@/lib/events/monthBuckets';
import { buildCheckinFormUrl, type CheckinFormConfig } from '@/lib/events/checkinForm';
import type { AppRole } from '@/types/database';

export interface EventTicketStat {
  title: string;
  issued: number;
  checkedIn: number;
  rate: number;
  startDate: string;
}

// The signed-in person's own year and roles — what "Preview AS Form" is built
// from, so the preview shows exactly what they'd see as an attendee (their
// year, their affiliation) rather than a made-up sample.
export async function getFormPreviewViewer(): Promise<{ year: string | null; classOf: number | null; roles: AppRole[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { year: null, classOf: null, roles: [] };
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from('profiles').select('year, class_of').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
  ]);
  return { year: profile?.year ?? null, classOf: profile?.class_of ?? null, roles: (roleRows ?? []).map((r) => r.role as AppRole) };
}

// Shared by the standalone /portal/events route and the portal hub.
export async function getEventsData() {
  const supabase = await createClient();
  const viewer = await getFormPreviewViewer();
  const [{ data: events }, { data: tickets }] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id, slug, division_id, title, flyer_url, theme, start_date, end_date, created_at, location, is_published, requires_ticket, audience, points_value, requires_checkin_form, checkin_food_item, checkin_form_event_name, checkin_form_override',
      )
      .order('start_date', { ascending: false })
      .limit(50),
    supabase.from('tickets').select('event_id, status, created_at, checked_in_at, user_id'),
  ]);

  // Divisions an event is shared with (accepted co-hosts); null is Triton Gaming itself, co-hosting a division's event.
  const sharedByEvent = new Map<string, (string | null)[]>();
  const ids = (events ?? []).map((e) => e.id as string);
  if (ids.length) {
    const { data: co } = await createServiceClient().from('event_cohosts').select('event_id, division_id').eq('status', 'accepted').in('event_id', ids);
    for (const c of co ?? []) sharedByEvent.set(c.event_id as string, [...(sharedByEvent.get(c.event_id as string) ?? []), (c.division_id as string | null) ?? null]);
  }

  const ticketsByEvent = new Map<string, { issued: number; checkedIn: number }>();
  (tickets ?? []).forEach((t) => {
    const bucket = ticketsByEvent.get(t.event_id) ?? { issued: 0, checkedIn: 0 };
    if (t.status === 'active' || t.status === 'used') bucket.issued++;
    if (t.status === 'used') bucket.checkedIn++;
    ticketsByEvent.set(t.event_id, bucket);
  });

  // Admin-facing preview link, built from the viewer's own profile (their
  // year and roles) — so it's exactly the prefill they'd get as an attendee.
  const eventsWithTickets = (events ?? []).map((e) => {
    const config = (e.checkin_form_override as CheckinFormConfig | null) ?? null;
    const checkinFormPreviewUrl =
      e.requires_checkin_form && config
        ? buildCheckinFormUrl(config, {
            eventTitle: e.checkin_form_event_name?.trim() || e.title,
            year: viewer.year,
            classOf: viewer.classOf,
            roles: viewer.roles,
            foodItem: e.checkin_food_item ?? null,
          })
        : null;
    const theme = cleanTheme(e.theme);
    return {
      ...e,
      poster: theme?.posters?.[0] || e.flyer_url || null,
      accent: theme?.colors.accent || null,
      sharedWith: sharedByEvent.get(e.id) ?? [],
      ticketsIssued: ticketsByEvent.get(e.id)?.issued ?? 0,
      ticketsCheckedIn: ticketsByEvent.get(e.id)?.checkedIn ?? 0,
      checkinFormPreviewUrl,
    };
  });

  // Analytics-tab data — moved here from the Admin card's Analytics tab
  // (see getStatsData.ts), since these are all per-event/event-entity
  // numbers, not org-wide platform metrics.
  // Events that have happened, counted by the month they took place in (when an event was created in the system says nothing useful).
  const nowMs = Date.now();
  const heldPerMonth = bucketByMonth((events ?? []).filter((e) => e.is_published && new Date(e.start_date).getTime() <= nowMs).map((e) => e.start_date));
  const ticketsPerMonth = bucketByMonth((tickets ?? []).map((t) => t.created_at));
  const checkinsPerMonth = bucketByMonth((tickets ?? []).filter((t) => t.checked_in_at).map((t) => t.checked_in_at as string));
  // The people behind the tickets: who had one, who came, and who came to more than one event.
  const eventsByUser = new Map<string, Set<string>>();
  const ticketed = new Set<string>();
  (tickets ?? []).forEach((t) => {
    if (!t.user_id) return;
    if (t.status === 'active' || t.status === 'used') ticketed.add(t.user_id as string);
    if (t.checked_in_at) {
      const set = eventsByUser.get(t.user_id as string) ?? new Set<string>();
      set.add(t.event_id as string);
      eventsByUser.set(t.user_id as string, set);
    }
  });
  const people = { ticketed: ticketed.size, came: eventsByUser.size, returned: [...eventsByUser.values()].filter((s) => s.size >= 2).length };
  const eventStats: EventTicketStat[] = (events ?? [])
    .map((e) => {
      const b = ticketsByEvent.get(e.id) ?? { issued: 0, checkedIn: 0 };
      return { title: e.title, issued: b.issued, checkedIn: b.checkedIn, rate: b.issued ? Math.round((b.checkedIn / b.issued) * 100) : 0, startDate: e.start_date };
    })
    .filter((e) => e.issued > 0)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 20)
    .reverse();

  const analytics = { heldPerMonth, ticketsPerMonth, checkinsPerMonth, eventStats, people };

  return { events: eventsWithTickets, analytics };
}

// Starting point for a new event's AS Form config. The form link (and its
// question IDs) differs for every event now, so nothing site-wide is
// reused — but the *answer mappings* (our year/role -> the form's option
// text) rarely change, so a new event starts from the most recent event's
// mappings with the link and question IDs left blank. Paste the new link and
// the editor reads the form and fills in the rest.
export async function getCheckinFormSeed() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select('checkin_form_override')
    .not('checkin_form_override', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = data?.checkin_form_override as CheckinFormConfig | null | undefined;
  if (!last) return undefined;
  return {
    form_url: '',
    entry_event_name: '',
    entry_academic_year: '',
    entry_affiliation: '',
    entry_food_item: '',
    year_mapping: last.year_mapping ?? [],
    affiliation_mapping: last.affiliation_mapping ?? [],
  };
}
