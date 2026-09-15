import { createClient } from '@/lib/supabase/server';
import type { RoleGrant } from '@/lib/capabilities';
import { isVerifiedMember } from '@/lib/capabilities';
import type TicketsClient from './TicketsClient';

// Shared by the standalone /portal/tickets route and the portal hub so both
// render the exact same data through the exact same query.
export async function getTicketsData(profileId: string, roles: RoleGrant[]) {
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      id, status, checked_in_at, created_at,
      event:events(id, title, start_date, end_date, location, flyer_url)
    `)
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });

  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('id, title, start_date, location, ticket_price, audience')
    .eq('is_published', true)
    .gte('start_date', new Date().toISOString())
    .order('start_date', { ascending: true })
    .limit(6);

  return {
    tickets: (tickets ?? []) as unknown as Parameters<typeof TicketsClient>[0]['tickets'],
    upcomingEvents: (upcomingEvents ?? []) as unknown as Parameters<typeof TicketsClient>[0]['upcomingEvents'],
    isUcsd: isVerifiedMember(roles),
  };
}
