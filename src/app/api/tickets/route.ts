import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { event_id } = await request.json();
  if (!event_id) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });

  // Verify event exists and accepts tickets
  const { data: event } = await supabase
    .from('events')
    .select('id, title, max_capacity, requires_ticket')
    .eq('id', event_id)
    .eq('is_published', true)
    .single();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Check capacity
  if (event.max_capacity) {
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .in('status', ['active', 'used']);

    if ((count ?? 0) >= event.max_capacity) {
      return NextResponse.json({ error: 'Event is at full capacity' }, { status: 409 });
    }
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({ event_id, user_id: user.id })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already registered for this event' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }

  return NextResponse.json({ ticket }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      id, ticket_code, status, checked_in_at, created_at,
      event:events(id, title, start_date, end_date, location, flyer_url)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ tickets });
}
