import { redirect } from 'next/navigation';
import { getProfile, getUserRoles, getMyPrivateProfile } from '@/lib/core/auth';
import { createClient } from '@/lib/supabase/server';
import { isVerifiedMember } from '@/lib/portal/capabilities';
import { getMissingProfileFields, yearChoiceOf } from '@/lib/members/profile';
import { getDivisions } from '@/lib/members/divisions';
import FinishProfile from './FinishProfile';

export const metadata = { title: 'Finish Your Profile' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Where to go afterwards: only a path inside the portal, never another site.
function safeNext(raw: string | undefined): string {
  return raw && /^\/portal(\/[A-Za-z0-9_\-./?=&%]*)?$/.test(raw) && !raw.includes('//') ? raw : '/portal';
}

// A stripped-down profile page for the moment someone needs it to continue (getting a ticket, checking in): the required details first, then the optional ones
// the club likes to have, clearly marked as skippable. Saving builds the profile and then finishes what they came to do (the ticket, the check-in) while a
// progress screen shows each step, then sends them on. The full profile stays in the portal for later.
//   ?next=  where to go afterwards      ?event=  the event they were getting a ticket for or checking in to      ?mode=  "ticket" or "checkin"
export default async function FinishProfilePage({ searchParams }: { searchParams: Promise<{ next?: string; event?: string; mode?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/portal/finish-profile?next=${next}`)}`);
  const [roles, priv, divisions] = await Promise.all([getUserRoles(), getMyPrivateProfile(), getDivisions()]);
  const isUcsd = isVerifiedMember(roles);
  if (getMissingProfileFields({ ...profile, gender: priv.gender }, isUcsd).length === 0) redirect(next);

  // The event, so the progress screen can name it. Only a published one, and only for the two things this page can finish.
  let event: { id: string; title: string } | null = null;
  const mode = sp.mode === 'ticket' || sp.mode === 'checkin' ? sp.mode : null;
  if (mode && sp.event && UUID.test(sp.event)) {
    const { data } = await (await createClient()).from('events').select('id, title').eq('id', sp.event).eq('is_published', true).maybeSingle();
    if (data) event = data;
  }

  return (
    <FinishProfile
      next={next}
      isUcsd={isUcsd}
      userId={profile.id}
      task={event && mode ? { mode, eventId: event.id, title: event.title } : null}
      divisions={divisions.map((d) => ({ id: d.id, name: d.name }))}
      initial={{
        name: profile.display_name ?? '', pronouns: profile.pronouns ?? '', gender: priv.gender ?? '', year: yearChoiceOf(profile), college: profile.college ?? '', major: profile.major ?? '',
        gamerTag: profile.gamer_tag ?? '', minor: profile.minor ?? '', platforms: priv.platforms, favoriteGames: priv.favorite_games, divisionInterests: priv.division_interests,
      }}
    />
  );
}
