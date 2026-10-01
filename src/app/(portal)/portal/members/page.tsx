import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import MembersSectionContent from './MembersSectionContent';
import { getMembersData } from './getMembersData';

export const metadata = { title: 'TG Members' };
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'view_members')) redirect('/portal');

  const { rows } = await getMembersData();

  return (
    <Suspense>
      <MembersSectionContent rows={rows} roles={roles} />
    </Suspense>
  );
}
