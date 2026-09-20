import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { rotatingCode, currentWindow } from '@/lib/rotatingCode';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, division_id')
    .eq('user_id', user.id);

  if (!hasCapability(roles ?? [], 'checkin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { code, event_id } = await request.json();
  if (!code || !event_id) {
    return NextResponse.json({ error: 'Missing code or event_id' }, { status: 400 });
  }

  // What's scanned/typed is a short-lived rotating code (see src/lib/rotatingCode.ts),
  // not the ticket's permanent secret — that never leaves the server. Fetch
  // every ticket (not just this event's) so a mismatch can be reported as
  // "wrong event" rather than a generic, unhelpful "not recognized".
  //
  // `tickets` has TWO foreign keys into `profiles` (user_id and
  // checked_in_by), so `user:profiles(display_name)` is genuinely ambiguous
  // to PostgREST — it errors, and with no error-check that silently became
  // an empty candidate list, which looked exactly like a permissions bug.
  // The `!tickets_user_id_fkey` hint picks the right relationship.
  const { data: allCandidates, error: candidatesError } = await supabase
    .from('tickets')
    .select(`
      id, ticket_code, status, checked_in_at, event_id, user_id,
      user:profiles!tickets_user_id_fkey(display_name),
      event:events(title)
    `);

  if (candidatesError) {
    console.error('[checkin] failed to load candidate tickets:', candidatesError);
    return NextResponse.json({ error: 'Failed to look up tickets. Please try again.' }, { status: 500 });
  }

  // Scanned QR data is prefixed with the event's slug (`slug:code`, see
  // src/app/api/tickets/[id]/qr/route.ts) purely as a human/scanner-visible
  // hint of which event it's for — it isn't part of the HMAC and carries no
  // authority, so it's simply dropped here before the real check.
  const raw = String(code).trim().replace(/^#\s*/, '');
  const normalizedCode = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
  const windowIndex = currentWindow();
  const matches = (t: { ticket_code: string }) =>
    rotatingCode(t.ticket_code, windowIndex) === normalizedCode ||
    rotatingCode(t.ticket_code, windowIndex - 1) === normalizedCode;

  const candidates = allCandidates ?? [];
  const ticket = candidates.filter((t) => t.event_id === event_id).find(matches);

  if (!ticket) {
    const wrongEventTicket = candidates.find(matches);
    if (wrongEventTicket) {
      const wrongEventData = Array.isArray(wrongEventTicket.event) ? wrongEventTicket.event[0] : wrongEventTicket.event;
      return NextResponse.json(
        { error: `This ticket is for a different event — ${wrongEventData?.title || 'another event'}. Switch events above to check them in.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Code not recognized — ask them to reopen their ticket and try again' }, { status: 404 });
  }

  const userData = Array.isArray(ticket.user) ? ticket.user[0] : ticket.user;
  const eventData = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;

  if (ticket.status !== 'active') {
    return NextResponse.json({
      status: ticket.status,
      event_title: eventData?.title || '',
      user_name: userData?.display_name || 'Unknown',
      checked_in_at: ticket.checked_in_at,
    });
  }

  const { error: updateError } = await supabase
    .from('tickets')
    .update({
      status: 'used',
      checked_in_at: new Date().toISOString(),
      checked_in_by: user.id,
    })
    .eq('id', ticket.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }

  // Notifying the ticket holder, not the officer running this scanner —
  // RLS only lets someone insert a notification for themselves (see
  // 20260920022210_allow_self_insert_notifications.sql), so this one
  // genuinely needs the service-role client. Best-effort: a failed
  // notification insert shouldn't undo a check-in that already succeeded.
  const serviceClient = createServiceClient();
  await serviceClient.from('notifications').insert({
    user_id: ticket.user_id,
    type: 'ticket_checked_in',
    title: "You're checked in!",
    body: eventData?.title ? `Enjoy ${eventData.title}.` : 'Enjoy the event.',
    href: '/portal/tickets',
  });

  return NextResponse.json({
    status: 'active',
    event_title: eventData?.title || '',
    user_name: userData?.display_name || 'Unknown',
  });
}
