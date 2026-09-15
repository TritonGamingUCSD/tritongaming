import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import QRStudioClient from './QRStudioClient';

export const metadata = { title: 'QR Studio' };
export const dynamic = 'force-dynamic';

export default async function QRStudioPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'generate_qr_codes')) redirect('/portal');

  return <QRStudioClient />;
}
