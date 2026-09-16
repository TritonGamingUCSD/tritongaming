import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import EventsSectionContent from './EventsSectionContent';
import { getEventsData } from './getEventsData';

export const metadata = { title: 'Event Management' };
export const dynamic = 'force-dynamic';

export default async function EventsManagementPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_events')) redirect('/portal');

  const { events } = await getEventsData();

  return <EventsSectionContent events={events} canEdit={hasCapability(roles, 'manage_events')} />;
}
