import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import NewEventClient from './NewEventClient';

export const metadata = { title: 'Create Event' };

export default async function NewEventPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'officer')) redirect('/portal');

  return <NewEventClient />;
}
