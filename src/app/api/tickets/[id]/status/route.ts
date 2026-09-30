import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCheckinFormUrl, type CheckinFormConfig } from '@/lib/checkinForm';
import type { AppRole } from '@/types/database';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

// Deliberately tiny/cheap — polled every few seconds by FullscreenQR as a
// backstop for the Realtime subscription (see enable_tickets_realtime
// migration). Realtime pushes the "checked in" update instantly when it's
// working; this guarantees the screen still catches up within a few seconds
// even if a Realtime connection never established (flaky network, a
// misbehaving proxy blocking websockets, etc.).
//
// Also the authoritative answer to "does this event need the AS Form, and
// where is it" — computed fresh here rather than trusting the URL baked into
// the page at load time, since a check-in screen can sit open long after
// that page loaded (or the event's form settings can change under it).
// Only does the extra queries once the ticket is actually checked in, so
// the every-4-seconds poll stays as cheap as before for everyone else.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ticket } = await supabase
    .from('tickets')
    .select('user_id, status, checked_in_at, checkin_form_completed_at, event:events(title, requires_checkin_form, checkin_food_item, checkin_form_event_name, checkin_form_override)')
    .eq('id', id)
    .single();

  if (!ticket || ticket.user_id !== user.id) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  let checkinFormUrl: string | null = null;
  const event = ticket.event as unknown as {
    title: string;
    requires_checkin_form: boolean;
    checkin_food_item: string | null;
    checkin_form_event_name: string | null;
    checkin_form_override: CheckinFormConfig | null;
  } | null;

  if (ticket.status === 'used' && event?.requires_checkin_form) {
    const [{ data: profile }, { data: roleRows }, { data: settings }] = await Promise.all([
      supabase.from('profiles').select('year').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('checkin_form_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    const config = event.checkin_form_override ?? settings;
    if (config) {
      checkinFormUrl = buildCheckinFormUrl(config, {
        eventTitle: event.checkin_form_event_name?.trim() || event.title,
        year: profile?.year ?? null,
        roles: (roleRows ?? []).map((r) => r.role as AppRole),
        foodItem: event.checkin_food_item ?? null,
      });
    }
  }

  return NextResponse.json({
    status: ticket.status,
    checked_in_at: ticket.checked_in_at,
    checkin_form_url: checkinFormUrl,
    checkin_form_completed_at: ticket.checkin_form_completed_at,
  });
}
