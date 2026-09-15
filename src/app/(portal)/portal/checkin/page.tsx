import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import CheckInClient from './CheckInClient';

export const metadata = { title: 'Check-In Scanner' };
export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'checkin')) redirect('/portal');

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
