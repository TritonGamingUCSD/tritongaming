import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  const { data: allCandidates } = await supabase
    .from('tickets')
    .select(`
      id, ticket_code, status, checked_in_at, event_id,
      user:profiles(display_name),
      event:events(title)
    `);

  // Manual entry displays the code uppercase for readability, but the
  // generated code is lowercase hex — normalize before comparing.
  const normalizedCode = String(code).trim().replace(/^#\s*/, '').toLowerCase();
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
    // Temporary diagnostics for the "code not recognized" reports — shows
    // exactly what the server currently expects for each active ticket at
    // this event, so a real mismatch (vs. a stale display) is visible on the
    // next failed scan instead of guessed at. Safe to show only to staff,
    // who already have checkin access to this data.
    const debugCandidates = candidates
      .filter((t) => t.event_id === event_id)
      .map((t) => ({
        status: t.status,
        expected_now: rotatingCode(t.ticket_code, windowIndex),
        expected_prev: rotatingCode(t.ticket_code, windowIndex - 1),
      }));

    // Look up this exact caller's own tickets directly (bypassing the
    // unfiltered query above) — if this also comes back empty for someone
    // who should own tickets, RLS itself is misbehaving for this session,
    // not just the checkin-capability OR-clause.
    const { data: ownTickets } = await supabase
      .from('tickets')
      .select('id, event_id')
      .eq('user_id', user.id);

    return NextResponse.json({
      error: 'Code not recognized — ask them to reopen their ticket and try again',
      debug: {
        received: normalizedCode,
        windowIndex,
        requestedEventId: event_id,
        totalVisibleTickets: candidates.length,
        otherEventIds: [...new Set(candidates.map((t) => t.event_id))],
        candidates: debugCandidates,
        callerId: user.id,
        callerEmail: user.email,
        callerRoles: roles,
        callerOwnTicketCount: (ownTickets ?? []).length,
      },
    }, { status: 404 });
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

  return NextResponse.json({
    status: 'active',
    event_title: eventData?.title || '',
    user_name: userData?.display_name || 'Unknown',
  });
}
