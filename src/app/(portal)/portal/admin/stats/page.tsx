import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import StatsClient from './StatsClient';
import { getStatsData } from './getStatsData';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_admin_dashboard')) redirect('/portal');

  const data = await getStatsData();

  return <StatsClient data={data} />;
}
