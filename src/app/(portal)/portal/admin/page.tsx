import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import AdminSectionContent from './AdminSectionContent';
import { getAdminData } from './getAdminData';
import { getStatsData } from './stats/getStatsData';
import { getRoleHistoryData } from './history/getRoleHistoryData';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_admin_dashboard')) redirect('/portal');

  const canManageRoles = hasCapability(roles, 'manage_roles');
  const [data, statsData, roleHistoryData] = await Promise.all([
    getAdminData(roles),
    getStatsData(),
    canManageRoles ? getRoleHistoryData() : Promise.resolve(null),
  ]);

  return <AdminSectionContent {...data} statsData={statsData} roleHistoryEntries={roleHistoryData?.entries} />;
}
