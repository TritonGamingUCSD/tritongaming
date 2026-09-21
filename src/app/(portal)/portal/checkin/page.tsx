import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import CheckInSectionContent from './CheckInSectionContent';
import { getCheckinData } from './getCheckinData';

export const metadata = { title: 'Check-In' };
export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'checkin')) redirect('/portal');

  const { events } = await getCheckinData();

  return (
    <CheckInSectionContent
      events={events}
      canScanRedemptions={hasCapability(roles, 'scan_redemptions')}
      canManagePoints={hasCapability(roles, 'manage_points')}
    />
  );
}
