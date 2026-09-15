import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rotatingCode, currentWindow, secondsUntilNextWindow } from '@/lib/rotatingCode';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, user_id, ticket_code, status, event:events(slug)')
    .eq('id', id)
    .single();

  // Deliberately owner-only, even though staff can read tickets via RLS for
  // check-in — nobody but the attendee should be able to mint their live code.
  if (!ticket || ticket.user_id !== user.id) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  if (ticket.status !== 'active') {
    return NextResponse.json({ error: 'Ticket is not active' }, { status: 400 });
  }

  const event = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;
  const code = rotatingCode(ticket.ticket_code, currentWindow());
  // The QR payload is prefixed with the event's slug so scanning it (with any
  // scanner, not just this app's) makes it unmistakable which event it's
  // for — see src/app/api/tickets/checkin/route.ts, which strips this prefix
  // before verifying the actual rotating code. `code` alone (no prefix) is
  // still returned for the manual-entry fallback text on screen.
  const qrData = event?.slug ? `${event.slug}:${code}` : code;
  return NextResponse.json({ code, qr_data: qrData, expires_in: secondsUntilNextWindow() });
}
