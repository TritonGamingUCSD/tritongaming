import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { isRewardsEligible } from '@/lib/portal/capabilities';
import { usesPortal } from '@/lib/portal/audience';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { PortalIdentityProvider } from '@/components/portal/PortalIdentity';
import '@/app/(portal)/portal-controls.css';
import MeTabs from './MeTabs';
import MeTheme from './MeTheme';
import styles from './me.module.css';

// Your own pages on the main site, for students and guests: events, tickets, calendar, rewards (students) and profile. Staff and members have the portal for the rest of their tools and can open these too.
// They wear the portal's dark colors, so they match the site around them.
export const metadata: Metadata = { title: 'My Triton Gaming', robots: { index: false, follow: false } };

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const [profile, roles] = await Promise.all([getProfile().catch(() => null), getUserRoles().catch(() => [])]);
  if (!profile) redirect('/login?next=/me');
  const name = profile.display_name || profile.google_first_name || 'there';
  const avatar = resolveAvatarUrl(profile);
  return (
    <PortalIdentityProvider id={profile.id} name={name} track>
      <MeTheme />
      <div className={`pp-root ${styles.wrap}`}>
        <header className={styles.head}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatar ? (
            <img src={avatar} alt="" width={44} height={44} className={styles.avatar} referrerPolicy="no-referrer" />
          ) : (
            <span className={styles.avatar}>{name[0]?.toUpperCase()}</span>
          )}
          <div>
            <p>My Triton Gaming</p>
            <h1>Hi, {name}</h1>
          </div>
        </header>
        <MeTabs rewards={isRewardsEligible(roles)} portal={usesPortal(roles)} />
        <div className={styles.sheet}>{children}</div>
      </div>
    </PortalIdentityProvider>
  );
}
