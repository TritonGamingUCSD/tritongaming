import { createServiceClient } from '@/lib/supabase/admin';
import { getProfile, getUserRoles, getMyPrivateProfile, getUser } from '@/lib/core/auth';
import { getDivisions } from '@/lib/members/divisions';
import { fetchLinkedEmails } from '@/lib/members/linkedEmails';
import { isVerifiedMember } from '@/lib/portal/capabilities';
import ProfileClient from '@/app/(portal)/portal/profile/ProfileClient';

export const dynamic = 'force-dynamic';

// Your info, linked accounts, notifications and email: the same profile page the portal has.
export default async function MyProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [profile, roles, divisions, privateInfo, authUser] = await Promise.all([getProfile(), getUserRoles(), getDivisions(), getMyPrivateProfile(), getUser()]);
  if (!profile) return null;
  const linkedEmails = authUser
    ? [
        ...new Set(
          [authUser.email, ...((await fetchLinkedEmails(createServiceClient(), [authUser.id])).get(authUser.id) ?? []).map((e) => e.email)].filter((e): e is string => !!e),
        ),
      ]
    : [];
  return (
    <ProfileClient
      profile={profile}
      privateInfo={privateInfo}
      email={authUser?.email ?? null}
      linkedEmails={linkedEmails}
      roles={roles}
      isUcsd={isVerifiedMember(roles)}
      divisions={divisions}
      initialTab={tab}
    />
  );
}
