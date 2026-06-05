import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import NewEventClient from './NewEventClient';

export const metadata = { title: 'Create Event' };

export default async function NewEventPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'officer')) redirect('/portal');

  const supabase = await createClient();
  const { data: divisions } = await supabase.from('divisions').select('id, name').eq('is_active', true).order('order_index');

  return <NewEventClient divisions={divisions || []} />;
}
