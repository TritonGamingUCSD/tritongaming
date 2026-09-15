import { Suspense } from 'react';
import { getProfile, getUserRoles } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isVerifiedMember } from '@/lib/capabilities';
import TicketsClient from './TicketsClient';

export const metadata = { title: 'My Tickets' };
export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) return null;

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      id, status, checked_in_at, created_at,
      event:events(id, title, start_date, end_date, location, flyer_url)
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  // Fetch upcoming events for the "register" section
  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('id, title, start_date, location, ticket_price, audience')
    .eq('is_published', true)
    .gte('start_date', new Date().toISOString())
    .order('start_date', { ascending: true })
    .limit(6);

  return (
    <Suspense>
      <TicketsClient
        tickets={(tickets ?? []) as unknown as Parameters<typeof TicketsClient>[0]['tickets']}
        upcomingEvents={(upcomingEvents ?? []) as unknown as Parameters<typeof TicketsClient>[0]['upcomingEvents']}
        isUcsd={isVerifiedMember(roles)}
      />
    </Suspense>
  );
}
