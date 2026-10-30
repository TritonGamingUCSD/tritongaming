import { notFound, redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import ScanScreen from '../../scan/ScanScreen';

export const metadata = { title: 'Code' };
export const dynamic = 'force-dynamic';

// Where a phone's own camera lands when it reads the QR code option of a ticket, a meeting's check-in or a reward pickup (see lib/qr/codeLink.ts). It does what the Scan button does with the same code: a
// meeting checks the person in, a ticket or a reward is for staff (anyone else is told so), and a signed-out visitor signs in first and comes straight back.
export default async function CodePage({ params }: { params: Promise<{ payload: string }> }) {
  const { payload } = await params;
  if (!/^[mtr][0-9a-f]{12}$/.test(payload)) notFound();
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/portal/code/${payload}`)}`);
  return <ScanScreen staff={hasCapability(roles, 'checkin')} redemptions={hasCapability(roles, 'scan_redemptions')} code={payload} />;
}
