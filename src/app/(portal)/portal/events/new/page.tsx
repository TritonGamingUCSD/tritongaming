import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import NewEventClient from './NewEventClient';

export const metadata = { title: 'Create Event' };

export default async function NewEventPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_events')) redirect('/portal');

  return <NewEventClient />;
}
