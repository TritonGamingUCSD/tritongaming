import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import CheckInClient from './CheckInClient';

export const metadata = { title: 'Check-In Scanner' };
export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'officer')) redirect('/portal');

  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date')
    .eq('is_published', true)
    .gte('start_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('start_date', { ascending: true })
    .limit(20);

  return <CheckInClient events={events || []} />;
}
