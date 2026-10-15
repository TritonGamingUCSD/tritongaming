import { redirect } from 'next/navigation';
import { getProfile, getUserRoles, getMyGender } from '@/lib/core/auth';
import { isVerifiedMember } from '@/lib/portal/capabilities';
import { getMissingProfileFields, yearChoiceOf } from '@/lib/members/profile';
import FinishProfile from './FinishProfile';

export const metadata = { title: 'Finish Your Profile' };
export const dynamic = 'force-dynamic';

// Where to go afterwards: only a path inside the portal, never another site.
function safeNext(raw: string | undefined): string {
  return raw && /^\/portal(\/[A-Za-z0-9_\-./?=&%]*)?$/.test(raw) && !raw.includes('//') ? raw : '/portal';
}

// A stripped-down profile page for the moment someone needs it to continue (getting a ticket, checking in): only what is required, nothing else. They are
// sent straight back to where they were afterwards. The full profile stays in the portal for later.
export default async function FinishProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/portal/finish-profile?next=${next}`)}`);
  const [roles, gender] = await Promise.all([getUserRoles(), getMyGender()]);
  const isUcsd = isVerifiedMember(roles);
  if (getMissingProfileFields({ ...profile, gender }, isUcsd).length === 0) redirect(next);

  return (
    <FinishProfile
      next={next}
      isUcsd={isUcsd}
      initial={{ name: profile.display_name ?? '', pronouns: profile.pronouns ?? '', gender: gender ?? '', year: yearChoiceOf(profile), college: profile.college ?? '', major: profile.major ?? '' }}
      userId={profile.id}
    />
  );
}
