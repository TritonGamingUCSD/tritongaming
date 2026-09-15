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
  // not the ticket's permanent secret — that never leaves the server. Find which
  // of this event's tickets currently produces it (checking this window and the
  // previous one, for clock skew / display lag).
  const { data: candidates } = await supabase
    .from('tickets')
    .select(`
      id, ticket_code, status, checked_in_at, event_id,
      user:profiles(display_name),
      event:events(title)
    `)
    .eq('event_id', event_id);

  // Manual entry displays the code uppercase for readability, but the
  // generated code is lowercase hex — normalize before comparing.
  const normalizedCode = String(code).trim().replace(/^#\s*/, '').toLowerCase();
  const windowIndex = currentWindow();
  const ticket = (candidates ?? []).find((t) =>
    rotatingCode(t.ticket_code, windowIndex) === normalizedCode ||
    rotatingCode(t.ticket_code, windowIndex - 1) === normalizedCode
  );

  if (!ticket) {
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

  return NextResponse.json({
    status: 'active',
    event_title: eventData?.title || '',
    user_name: userData?.display_name || 'Unknown',
  });
}
