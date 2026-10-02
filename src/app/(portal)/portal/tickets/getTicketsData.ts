import { createClient } from '@/lib/supabase/server';
import type { RoleGrant } from '@/lib/capabilities';
import { isVerifiedMember, isRewardsEligible } from '@/lib/capabilities';
import { buildCheckinFormUrl, type CheckinFormConfig } from '@/lib/checkinForm';
import { openEventsFilter } from '@/lib/checkinWindow';
import { pacificDayKey } from '@/lib/checkinDays';
import type TicketsClient from './TicketsClient';

// Shared by the standalone /portal/tickets route and the portal hub so both
// render the exact same data through the exact same query.
export async function getTicketsData(profileId: string, roles: RoleGrant[]) {
  const supabase = await createClient();

  const [{ data: tickets }, { data: upcomingEvents }, { data: profile }] = await Promise.all([
    supabase
      .from('tickets')
      .select(`
        id, status, checked_in_at, created_at, checkin_form_completed_at,
        event:events(id, title, start_date, end_date, location, flyer_url, points_value, is_online, checkin_windows, requires_checkin_form, checkin_food_item, checkin_form_event_name, checkin_form_override)
      `)
      .eq('user_id', profileId)
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('id, title, start_date, end_date, location, ticket_price, audience, points_value, is_online')
      .eq('is_published', true)
      // Joinable until the event ends (same rule as check-in), not just
      // before it starts — someone arriving partway through should still be
      // able to get a ticket.
      .or(openEventsFilter())
      .order('start_date', { ascending: true })
      .limit(6),
    supabase.from('profiles').select('year, class_of').eq('id', profileId).maybeSingle(),
  ]);

  // Pre-computed here (server-side, ahead of time) rather than fetched at
  // the moment someone's actually checked in — the whole point is that the
  // form is ready to render on their phone the instant check-in happens,
  // with no extra round-trip competing with "get everyone through the
  // door fast." The client only ever *displays* this once status flips to
  // 'used' (see FullscreenQR/OnlineCheckinEntry) — having the URL earlier
  // doesn't expose the form before a real check-in, since nothing renders
  // it until then.
  // Multi-day events: which of these tickets have already been scanned in today.
  const ticketIds = (tickets ?? []).map((t) => t.id);
  const { data: todayRows } = ticketIds.length
    ? await supabase.from('ticket_checkins').select('ticket_id').in('ticket_id', ticketIds).eq('day', pacificDayKey())
    : { data: [] as { ticket_id: string }[] };
  const checkedInToday = new Set((todayRows ?? []).map((r) => r.ticket_id));

  const roleNames = roles.map((r) => r.role);
  const ticketsWithForm = (tickets ?? []).map((t) => {
    const event = t.event as unknown as {
      title: string;
      requires_checkin_form?: boolean;
      checkin_food_item?: string | null;
      checkin_form_event_name?: string | null;
      checkin_form_override?: CheckinFormConfig | null;
    } | null;
    // The AS Form is configured per event (its own URL, entry IDs and
    // mappings live in checkin_form_override) — UCSD's form changes from
    // event to event, so there's no shared site-wide default any more.
    const config = event?.checkin_form_override ?? null;
    const checkinFormUrl = event?.requires_checkin_form && config
      ? buildCheckinFormUrl(config, {
          eventTitle: event.checkin_form_event_name?.trim() || event.title,
          year: profile?.year ?? null,
          classOf: profile?.class_of ?? null,
          roles: roleNames,
          foodItem: event.checkin_food_item ?? null,
        })
      : null;
    return { ...t, checkinFormUrl, checkedInToday: checkedInToday.has(t.id) };
  });

  return {
    tickets: ticketsWithForm as unknown as Parameters<typeof TicketsClient>[0]['tickets'],
    upcomingEvents: (upcomingEvents ?? []) as unknown as Parameters<typeof TicketsClient>[0]['upcomingEvents'],
    isUcsd: isVerifiedMember(roles),
    canEarnPoints: isRewardsEligible(roles),
  };
}
