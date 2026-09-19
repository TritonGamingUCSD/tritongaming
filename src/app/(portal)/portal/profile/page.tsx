import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/auth';
import { isVerifiedMember } from '@/lib/capabilities';
import { getDivisions } from '@/lib/divisions';
import ProfileClient from './ProfileClient';

export const metadata = { title: 'My Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [profile, roles, divisions] = await Promise.all([getProfile(), getUserRoles(), getDivisions()]);
  if (!profile) redirect('/login?next=/portal/profile');
  return (
    <Suspense>
      <ProfileClient profile={profile} roles={roles} isUcsd={isVerifiedMember(roles)} divisions={divisions} />
    </Suspense>
  );
}
