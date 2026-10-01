import { openEventsFilter } from '@/lib/checkinWindow';
import { createClient } from '@/lib/supabase/server';

// Shared by the standalone /portal/checkin route and the portal hub.
export async function getCheckinData() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date, is_online')
    .eq('is_published', true)
    // Every event that can still be checked into — same rule as the check-in
    // itself (until its end time), so a multi-day or long-running event
    // doesn't drop off the scanner's list 24h after it started.
    .or(openEventsFilter())
    .order('start_date', { ascending: true })
    .limit(20);

  return { events: events ?? [] };
}
