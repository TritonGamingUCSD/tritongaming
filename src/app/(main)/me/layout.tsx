import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { isRewardsEligible } from '@/lib/portal/capabilities';
import { usesPortal } from '@/lib/portal/audience';
import { PageHero } from '@/components/ZineBand/ZineBand';
import { PortalIdentityProvider } from '@/components/portal/PortalIdentity';
import MeTabs from './MeTabs';
import '@/app/(portal)/portal-controls.css';
import styles from './me.module.css';

// Your own pages on the main site, for students and guests: tickets, calendar, rewards (students) and profile. Staff and members have the portal for the rest of their tools and can open these too.
export const metadata: Metadata = { title: 'My Triton Gaming', robots: { index: false, follow: false } };

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const [profile, roles] = await Promise.all([getProfile().catch(() => null), getUserRoles().catch(() => [])]);
  if (!profile) redirect('/login?next=/me');
  const name = profile.display_name || profile.google_first_name || 'there';
  return (
    <PortalIdentityProvider id={profile.id} name={name} track>
      <PageHero label="My Triton Gaming" title={`Hi, ${name}`} />
      <div className={styles.wrap}>
        <MeTabs rewards={isRewardsEligible(roles)} portal={usesPortal(roles)} />
        <div className={`pp-root ${styles.sheet}`}>{children}</div>
      </div>
    </PortalIdentityProvider>
  );
}
