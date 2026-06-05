import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/types/database';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !hasRole(profile.role, 'officer')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { ticket_code, event_id } = await request.json();
  if (!ticket_code || !event_id) {
    return NextResponse.json({ error: 'Missing ticket_code or event_id' }, { status: 400 });
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      id, status, checked_in_at, event_id,
      user:profiles(display_name),
      event:events(title)
    `)
    .eq('ticket_code', ticket_code)
    .eq('event_id', event_id)
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: 'Ticket not found for this event' }, { status: 404 });
  }

  const userData = Array.isArray(ticket.user) ? ticket.user[0] : ticket.user;
  const eventData = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;

  if (ticket.status !== 'active') {
    return NextResponse.json({
      ticket_code,
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
    ticket_code,
    status: 'active',
    event_title: eventData?.title || '',
    user_name: userData?.display_name || 'Unknown',
  });
}
