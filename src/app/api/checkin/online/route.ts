import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { rotatingCode, currentEventCodeWindow } from '@/lib/rotatingCode';
import { performCheckin } from '@/lib/performCheckin';

// Member-facing self-check-in for online events — see the sibling
// api/checkin/online/[eventId]/code (officer-facing reveal) for the code
// this verifies against. Always reads events.checkin_secret through the
// service-role client, never the caller's own — unlike tickets.ticket_code
// (which checkin-capable officers are trusted to read directly, see
// api/tickets/checkin), this secret specifically must never be reachable
// by the exact audience — regular members — who are the ones typing a
// code in here.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { event_id, code } = await request.json();
  if (!event_id || !code) {
    return NextResponse.json({ error: 'Missing event_id or code' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // The real anti-sharing gate: entering a leaked/shared code does nothing
  // for someone who never actually registered for this specific event.
  const { data: ticket } = await serviceClient
    .from('tickets')
    .select('id, user_id, status, event_id')
    .eq('event_id', event_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.json({ error: "You don't have a ticket for this event." }, { status: 403 });
  }

  const { data: event } = await serviceClient
    .from('events')
    .select('title, points_value, checkin_secret, start_date, end_date')
    .eq('id', event_id)
    .single();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const normalizedCode = String(code).trim();
  const windowIndex = currentEventCodeWindow();
  const valid =
    rotatingCode(event.checkin_secret, windowIndex) === normalizedCode ||
    rotatingCode(event.checkin_secret, windowIndex - 1) === normalizedCode;

  if (!valid) {
    return NextResponse.json({ error: 'That code is incorrect or has expired — ask for the current one.' }, { status: 400 });
  }

  if (ticket.status !== 'active') {
    return NextResponse.json({ error: ticket.status === 'used' ? "You're already checked in." : 'This ticket is no longer valid.' }, { status: 409 });
  }

  const { error: checkinError } = await performCheckin(
    serviceClient,
    ticket,
    { title: event.title, points_value: event.points_value, start_date: event.start_date, end_date: event.end_date },
    user.id
  );
  if (checkinError) {
    const status = checkinError.includes('already ended') ? 409 : 500;
    return NextResponse.json({ error: checkinError }, { status });
  }

  return NextResponse.json({ status: 'active', event_title: event.title });
}
