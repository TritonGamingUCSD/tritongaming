import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/portal/capabilities';
import { pacificDayKey } from '@/lib/events/checkinDays';

interface Params {
  params: Promise<{ id: string }>;
}

// Powers the check-ins page in Events (EventCheckinsPage.tsx). `id` is the event's slug, or its id.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'view_events')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const byId = /^[0-9a-f-]{36}$/i.test(id);
  const { data: event } = await supabase.from('events').select('id, title, start_date, end_date, location, requires_checkin_form').eq(byId ? 'id' : 'slug', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const [{ data: ticketsData, error: ticketsError }] = await Promise.all([
    supabase
      .from('tickets')
      .select('id, status, created_at, checked_in_at, checkin_form_completed_at, user:profiles!tickets_user_id_fkey(display_name, avatar_url, custom_avatar_url, gamer_tag)')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true }),
  ]);

  if (ticketsError) {
    console.error('[event checkins api] failed to load tickets:', ticketsError);
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 });
  }

  // Multi-day events: how many days each ticket has been scanned in, and whether today's is done.
  const { data: dayRows } = await supabase.from('ticket_checkins').select('ticket_id, day').eq('event_id', event.id);
  const today = pacificDayKey();
  const daysByTicket = new Map<string, { n: number; today: boolean }>();
  for (const r of dayRows ?? []) {
    const cur = daysByTicket.get(r.ticket_id as string) ?? { n: 0, today: false };
    cur.n++;
    if (r.day === today) cur.today = true;
    daysByTicket.set(r.ticket_id as string, cur);
  }
  const tickets = (ticketsData ?? []).map((t) => ({ ...t, days_attended: daysByTicket.get(t.id)?.n ?? 0, checked_in_today: daysByTicket.get(t.id)?.today ?? false }));

  return NextResponse.json({ event, tickets });
}
