import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/capabilities';
import { fetchTiers } from '@/lib/tiers';
import CheckInSectionContent from './CheckInSectionContent';
import { getCheckinData } from './getCheckinData';

export const metadata = { title: 'Check-In' };
export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'checkin')) redirect('/portal');

  const supabase = await createClient();
  const [{ events }, tiers] = await Promise.all([getCheckinData(), fetchTiers(supabase)]);

  return (
    <CheckInSectionContent
      events={events}
      canScanRedemptions={hasCapability(roles, 'scan_redemptions')}
      canManagePoints={hasCapability(roles, 'manage_points')}
      tiers={tiers}
    />
  );
}
