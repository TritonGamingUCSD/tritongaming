import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import CheckInClient from './CheckInClient';
import { getCheckinData } from './getCheckinData';

export const metadata = { title: 'Check-In Scanner' };
export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'checkin')) redirect('/portal');

  const { events } = await getCheckinData();

  return <CheckInClient events={events} />;
}
