import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import ProfileClient from './ProfileClient';

export const metadata = { title: 'My Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect('/login?next=/portal/profile');
  return <ProfileClient profile={profile} />;
}
