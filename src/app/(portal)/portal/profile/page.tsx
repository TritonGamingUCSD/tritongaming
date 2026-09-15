import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/auth';
import ProfileClient from './ProfileClient';

export const metadata = { title: 'My Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) redirect('/login?next=/portal/profile');
  return (
    <Suspense>
      <ProfileClient profile={profile} roles={roles} />
    </Suspense>
  );
}
