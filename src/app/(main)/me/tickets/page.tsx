import { getProfile, getUserRoles } from '@/lib/core/auth';
import TicketsSectionContent from '@/app/(portal)/portal/tickets/TicketsSectionContent';
import { getTicketsData } from '@/app/(portal)/portal/tickets/getTicketsData';

export const dynamic = 'force-dynamic';

// The same tickets page the portal has, on the main site.
export default async function MyTicketsPage() {
  const profile = await getProfile();
  if (!profile) return null; // (the layout has already sent them to sign in)
  const roles = await getUserRoles();
  const data = await getTicketsData(profile.id, roles);
  return <TicketsSectionContent tickets={data.tickets} upcomingEvents={data.upcomingEvents} isUcsd={data.isUcsd} canEarnPoints={data.canEarnPoints} activity={data.tickets} />;
}
