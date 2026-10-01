import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles, getMyPrivateProfile, getUser } from '@/lib/auth';
import { isVerifiedMember } from '@/lib/capabilities';
import { getDivisions } from '@/lib/divisions';
import ProfileClient from './ProfileClient';

export const metadata = { title: 'My Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [profile, roles, divisions, gender, authUser] = await Promise.all([getProfile(), getUserRoles(), getDivisions(), getMyPrivateProfile(), getUser()]);
  if (!profile) redirect('/login?next=/portal/profile');
  return (
    <Suspense>
      <ProfileClient profile={profile} privateInfo={gender} email={authUser?.email ?? null} roles={roles} isUcsd={isVerifiedMember(roles)} divisions={divisions} />
    </Suspense>
  );
}
