import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import EventsSectionContent from './EventsSectionContent';
import { getEventsData, getCheckinFormSettings } from './getEventsData';

export const metadata = { title: 'Event Management' };
export const dynamic = 'force-dynamic';

export default async function EventsManagementPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_events')) redirect('/portal');

  const canEdit = hasCapability(roles, 'manage_events');
  const [{ events, eventsPerMonth, ticketsPerMonth, eventStats }, checkinFormSettings] = await Promise.all([
    getEventsData(),
    canEdit ? getCheckinFormSettings() : Promise.resolve(undefined),
  ]);

  return (
    <EventsSectionContent
      events={events}
      eventsPerMonth={eventsPerMonth}
      ticketsPerMonth={ticketsPerMonth}
      eventStats={eventStats}
      canEdit={canEdit}
      canManagePoints={hasCapability(roles, 'manage_points')}
      checkinFormSettings={checkinFormSettings}
    />
  );
}
