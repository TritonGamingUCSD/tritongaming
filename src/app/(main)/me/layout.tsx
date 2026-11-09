import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { isRewardsEligible } from '@/lib/portal/capabilities';
import { usesPortal } from '@/lib/portal/audience';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { PortalIdentityProvider } from '@/components/portal/PortalIdentity';
import '@/app/(portal)/portal-controls.css';
import Link from 'next/link';
import MeBar from './MeBar';
import MeHeading from './MeHeading';
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
      <div data-me-site className={`pp-root ${styles.wrap}`}>
        <MeBar name={name} avatar={avatar} portal={usesPortal(roles)} />
        <MeTabs rewards={isRewardsEligible(roles)} portal={false} />
        <div className={styles.main}>
          <MeHeading />
          <div className={styles.sheet}>{children}</div>
        </div>
        <footer className={styles.foot}>
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · Gaming Org at UC San Diego
        </footer>
      </div>
    </PortalIdentityProvider>
  );
}
