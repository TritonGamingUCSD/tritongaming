import type { SupabaseClient } from '@supabase/supabase-js';

// Shared by the officer-run QR/manual scanner (api/tickets/checkin) and the
// member-run online self-check-in (api/checkin/online) — both end up doing
// the exact same three things once a valid ticket is identified: flip it
// to used, award points, notify the ticket holder. Keeping this in one
// place means a future change to any of those three steps can't
// accidentally apply to only one of the two check-in paths.
export async function performCheckin(
  serviceClient: SupabaseClient,
  ticket: { id: string; user_id: string },
  eventTitle: string | null,
  pointsValue: number,
  checkedInBy: string
): Promise<{ error?: string }> {
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
    title: "You're checked in!",
    body: [
      eventTitle ? `Enjoy ${eventTitle}.` : 'Enjoy the event.',
      pointsAwarded && pointsValue > 0 ? `+${pointsValue} points earned.` : null,
    ].filter(Boolean).join(' '),
    href: '/portal/tickets',
  });

  return {};
}
