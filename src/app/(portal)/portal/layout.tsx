import { Suspense } from 'react';
import { Exo_2, JetBrains_Mono } from 'next/font/google';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles, getMyGender } from '@/lib/auth';
import { isVerifiedMember, canSetOrgTitle } from '@/lib/capabilities';
import { getMissingProfileFields } from '@/lib/profile';
import ProfileIncompleteBanner from '@/components/portal/ProfileIncompleteBanner';
import NotificationBell from '@/components/portal/NotificationBell';
import ConnectivityBanner from '@/components/ConnectivityBanner/ConnectivityBanner';
import styles from './portal.module.css';

// Portal-only type: Exo 2 for text (made for small UI sizes, has real in-between weights and
// aligned digits) and JetBrains Mono for codes. Futura Heavy stays for titles. The public site
// is untouched — these only apply inside this layout (see .fontScope in portal.module.css).
const portalSans = Exo_2({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jb-mono', display: 'swap' });

export const metadata = { title: 'Member Portal' };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect('/login?next=/portal');

  // Anything required still blank on this person's profile — surfaced as a
  // banner on every portal page, not only when a ticket claim bounces them.
  const [roles, gender] = await Promise.all([getUserRoles(), getMyGender()]);
  const isUcsdMember = isVerifiedMember(roles);
  const missingProfileFields = getMissingProfileFields({ ...profile, gender }, isUcsdMember, { requireOrgTitle: canSetOrgTitle(roles) });
  // Only the officer title missing -> send them straight to the Officer Card tab.
  const missingOnlyOfficerTab = missingProfileFields.length > 0 && getMissingProfileFields({ ...profile, gender }, isUcsdMember).length === 0;

  return (
    <div className={`${styles.layout} ${styles.fontScope} ${portalSans.variable} ${jbMono.variable}`} data-portal-layout>
      <main className={styles.main}>
        <div className={styles.content}>
          <div data-print-hide style={{ display: 'contents' }}>
            <Suspense fallback={null}>
              <ProfileIncompleteBanner missing={missingProfileFields} officerTabOnly={missingOnlyOfficerTab} />
            </Suspense>
          </div>
          {children}
        </div>
      </main>
      {/* Fixed to the viewport, not slotted into .content — needs to stay
          reachable on /portal itself, which is the one page PortalTopbar
          (the other persistent portal chrome) deliberately hides on. */}
      <div data-print-hide style={{ display: 'contents' }}>
        <NotificationBell />
        <ConnectivityBanner />
      </div>
    </div>
  );
}
