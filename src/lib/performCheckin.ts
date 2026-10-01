import type { SupabaseClient } from '@supabase/supabase-js';
import { isCheckinWindowOpen } from '@/lib/checkinWindow';

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
  ticket: { id: string; user_id: string },
  event: { title: string | null; start_date: string; end_date: string | null; points_value: number; requires_checkin_form?: boolean | null },
  checkedInBy: string,
  // Manual check-in by an exec/admin (api/checkin/manual) passes true: it's a
  // correction made by someone who can already reverse points, so it works
  // after the event has ended too — e.g. fixing a missed check-in the next
  // day. The scanner and online self-check-in never set this; they stay
  // bound to the event's window.
  opts: { ignoreWindow?: boolean } = {}
): Promise<{ error?: string }> {
  if (!opts.ignoreWindow && !isCheckinWindowOpen(event)) {
    return { error: 'This event has already ended — the ticket is no longer valid for check-in.' };
  }

  const { error: updateError } = await serviceClient
    .from('tickets')
    .update({ status: 'used', checked_in_at: new Date().toISOString(), checked_in_by: checkedInBy })
    .eq('id', ticket.id)
    .eq('status', 'active'); // guards against a race with a second, near-simultaneous check-in attempt

  if (updateError) return { error: 'Failed to update ticket' };

  const { data: pointsAwarded, error: pointsError } = await serviceClient.rpc('award_checkin_points', {
    _ticket_id: ticket.id,
    _checked_in_by: checkedInBy,
  });
  if (pointsError) console.error('[performCheckin] failed to award points:', pointsError);

  await serviceClient.from('notifications').insert({
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
  });

  return {};
}
