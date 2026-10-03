import { createNotifications } from '@/lib/notify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isCheckinWindowOpen, checkinHoursError, type CheckinDayWindow } from '@/lib/checkinWindow';
import { isMultiDayEvent, pacificDayKey, currentDayInfo } from '@/lib/checkinDays';

// Nothing anywhere else in this app ever moves a ticket's status away from
// 'active' once it's issued — there's no cron/trigger that expires one when
// its event passes. Without the isCheckinWindowOpen check below, a ticket
// (or its QR/rotating code, which stays valid indefinitely since it's just
// an HMAC of the permanent ticket_code) would still successfully check
// someone in for an event that ended weeks ago.

// Shared by the officer-run QR/manual scanner (api/tickets/checkin) and the
// member-run online self-check-in (api/checkin/online) — both end up doing
// the exact same four things once a valid ticket is identified: confirm the
// event's check-in window hasn't closed, flip the ticket to used, award
// points, notify the ticket holder. Keeping this in one place means a
// future change to any of those steps can't accidentally apply to only one
// of the two check-in paths.
export async function performCheckin(
  serviceClient: SupabaseClient,
  ticket: { id: string; user_id: string; event_id?: string },
  event: { title: string | null; start_date: string; end_date: string | null; points_value: number; requires_checkin_form?: boolean | null; checkin_windows?: CheckinDayWindow[] | null },
  checkedInBy: string,
  // Manual check-in by an exec/admin (api/checkin/manual) passes true: it's a
  // correction made by someone who can already reverse points, so it works
  // after the event has ended too — e.g. fixing a missed check-in the next
  // day. The scanner and online self-check-in never set this; they stay
  // bound to the event's window.
  opts: { ignoreWindow?: boolean } = {}
): Promise<{ error?: string; firstCheckin?: boolean; day?: { day: number; total: number } | null }> {
  if (!opts.ignoreWindow && !isCheckinWindowOpen(event)) {
    return { error: 'This event has already ended — the ticket is no longer valid for check-in.' };
  }

  const multiDay = isMultiDayEvent(event.start_date, event.end_date);
  const now = new Date();
  if (!opts.ignoreWindow) {
    const hoursError = checkinHoursError(event, now);
    if (hoursError) return { error: hoursError };
  }

  let eventId = ticket.event_id;
  if (!eventId) {
    const { data } = await serviceClient.from('tickets').select('event_id').eq('id', ticket.id).maybeSingle();
    eventId = data?.event_id as string | undefined;
  }

  // One row per ticket per Pacific day. For a multi-day event a duplicate means they were
  // already scanned in today.
  if (eventId) {
    const { error: dayError } = await serviceClient.from('ticket_checkins').insert({
      ticket_id: ticket.id, event_id: eventId, day: pacificDayKey(now), checked_in_at: now.toISOString(), checked_in_by: checkedInBy,
    });
    if (dayError) {
      if (dayError.code === '23505') {
        if (multiDay) return { error: "Already checked in for today." };
      } else {
        console.error('[performCheckin] failed to record day check-in:', dayError);
      }
    }
  }

  // First check-in flips the ticket to used (guarded against a near-simultaneous second scan).
  const { data: flipped, error: updateError } = await serviceClient
    .from('tickets')
    .update({ status: 'used', checked_in_at: now.toISOString(), checked_in_by: checkedInBy })
    .eq('id', ticket.id)
    .eq('status', 'active')
    .select('id');

  if (updateError) return { error: 'Failed to update ticket' };
  const firstCheckin = (flipped?.length ?? 0) > 0;
  const day = multiDay ? currentDayInfo(event.start_date, event.end_date) : null;

  // Later days of a multi-day event: attendance only — points are earned once, on the first check-in.
  if (multiDay && !firstCheckin) {
    await createNotifications(serviceClient, [{
      user_id: ticket.user_id,
      type: 'ticket_checked_in',
      title: day ? `Checked in — Day ${day.day} of ${day.total}` : "You're checked in!",
      body: event.title ? `Enjoy ${event.title}.` : 'Enjoy the event.',
      href: '/portal?section=tickets',
    }]);
    return { firstCheckin: false, day };
  }

  const { data: pointsAwarded, error: pointsError } = await serviceClient.rpc('award_checkin_points', {
    _ticket_id: ticket.id,
    _checked_in_by: checkedInBy,
  });
  if (pointsError) console.error('[performCheckin] failed to award points:', pointsError);

  await createNotifications(serviceClient, [{
    user_id: ticket.user_id,
    type: 'ticket_checked_in',
    title: event.requires_checkin_form ? 'Scanned in — one more step' : "You're checked in!",
    body: [
      event.requires_checkin_form
        ? 'Open My Tickets and fill out your AS Form to finish checking in.'
        : event.title ? `Enjoy ${event.title}.` : 'Enjoy the event.',
      pointsAwarded && event.points_value > 0 ? `+${event.points_value} points earned.` : null,
    ].filter(Boolean).join(' '),
    href: '/portal?section=tickets',
  }]);

  return { firstCheckin: true, day };
}
