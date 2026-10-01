import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles, getMyGender } from '@/lib/auth';
import { isVerifiedMember, canSetOrgTitle } from '@/lib/capabilities';
import { getMissingProfileFields } from '@/lib/profile';
import ProfileIncompleteBanner from '@/components/portal/ProfileIncompleteBanner';
import PortalTopbar from '@/components/portal/PortalTopbar';
import NotificationBell from '@/components/portal/NotificationBell';
import ConnectivityBanner from '@/components/ConnectivityBanner/ConnectivityBanner';
import styles from './portal.module.css';

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
    <div className={styles.layout} data-portal-layout>
      <main className={styles.main}>
        <div data-print-hide style={{ display: 'contents' }}><PortalTopbar /></div>
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
