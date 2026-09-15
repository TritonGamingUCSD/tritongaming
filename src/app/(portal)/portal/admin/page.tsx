import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import AdminSectionContent from './AdminSectionContent';
import { getAdminData } from './getAdminData';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_admin_dashboard')) redirect('/portal');

  const data = await getAdminData(roles);

  return <AdminSectionContent {...data} />;
}
