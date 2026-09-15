import { createClient } from '@/lib/supabase/server';

// Shared by the standalone /portal/events route and the portal hub.
export async function getEventsData() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date, location, is_published, requires_ticket, max_capacity')
    .order('start_date', { ascending: false })
    .limit(50);

  return { events: events ?? [] };
}
