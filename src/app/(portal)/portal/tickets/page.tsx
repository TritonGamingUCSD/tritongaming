import { Suspense } from 'react';
import { getProfile, getUserRoles } from '@/lib/auth';
import TicketsClient from './TicketsClient';
import { getTicketsData } from './getTicketsData';

export const metadata = { title: 'My Tickets' };
export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) return null;

  const { tickets, upcomingEvents, isUcsd, canEarnPoints } = await getTicketsData(profile.id, roles);

  return (
    <Suspense>
      <TicketsClient tickets={tickets} upcomingEvents={upcomingEvents} isUcsd={isUcsd} canEarnPoints={canEarnPoints} />
    </Suspense>
  );
}
