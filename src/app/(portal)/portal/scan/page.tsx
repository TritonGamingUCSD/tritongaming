import { redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import ScanScreen from './ScanScreen';

export const metadata = { title: 'Scan' };
export const dynamic = 'force-dynamic';

// The page behind the Scan button in the phone's bottom bar. What a person may do with what they scan is settled here, from their roles, before the camera opens.
export default async function ScanPage() {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) redirect(`/login?next=${encodeURIComponent('/portal/scan')}`);
  return <ScanScreen staff={hasCapability(roles, 'checkin')} redemptions={hasCapability(roles, 'scan_redemptions')} />;
}
