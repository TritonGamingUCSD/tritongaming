import { createClient } from '@/lib/supabase/server';

// Shared by the standalone /portal/checkin route and the portal hub.
export async function getCheckinData() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date, is_online')
    .eq('is_published', true)
    .gte('start_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('start_date', { ascending: true })
    .limit(20);

  return { events: events ?? [] };
}
