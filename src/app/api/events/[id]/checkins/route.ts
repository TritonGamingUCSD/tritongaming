import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/capabilities';

interface Params {
  params: Promise<{ id: string }>;
}

// Powers the check-ins modal opened from the Event Management list (see
// EventCheckinsModal.tsx) — the same data the standalone
// /portal/events/[id]/checkins page renders, just fetched client-side so
// opening it doesn't navigate away from wherever you were in the hub.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'view_events')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const [{ data: event }, { data: ticketsData, error: ticketsError }] = await Promise.all([
    supabase.from('events').select('id, title, start_date, location, requires_checkin_form').eq('id', id).single(),
    supabase
      .from('tickets')
      .select('id, status, created_at, checked_in_at, checkin_form_completed_at, user:profiles!tickets_user_id_fkey(display_name, avatar_url, custom_avatar_url, gamer_tag)')
      .eq('event_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (ticketsError) {
    console.error('[event checkins api] failed to load tickets:', ticketsError);
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 });
  }

  return NextResponse.json({ event, tickets: ticketsData ?? [] });
}
