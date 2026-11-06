import { Suspense } from 'react';
import { Exo_2, JetBrains_Mono } from 'next/font/google';
import { redirect } from 'next/navigation';
import { getProfile, getUserRoles, getMyGender, getViewAs, getViewingUser } from '@/lib/core/auth';
import { ViewAsBanner, ViewingUserBanner } from '@/components/portal/ViewAs';
import ViewOnlyGuard from '@/components/portal/ViewOnlyGuard';
import SessionGuard from '@/components/portal/SessionGuard';
import { isVerifiedMember, requiresOrgTitle } from '@/lib/portal/capabilities';
import { getMissingProfileFields } from '@/lib/members/profile';
import ProfileIncompleteBanner from '@/components/portal/ProfileIncompleteBanner';
import LinkAccountBanner from '@/components/portal/LinkAccountBanner';
import NotificationBell from '@/components/portal/NotificationBell';
import CodeButton from '@/components/portal/CodeButton';
import PortalThemeToggle from '@/components/portal/PortalThemeToggle';
import MainSiteLink from '@/components/portal/MainSiteLink';
import PullToRefresh from '@/components/portal/PullToRefresh';
import AttributionCapture from '@/components/AttributionCapture/AttributionCapture';
import ConnectivityBanner from '@/components/ConnectivityBanner/ConnectivityBanner';
import InstallAsk from '@/components/portal/InstallAsk';
import HideOnPaths from '@/components/portal/HideOnPaths';
import PortalBanner from '@/components/portal/PortalBanner';
import SiteSettingsProvider from '@/components/portal/SiteSettingsProvider';
import { DivisionDirectoryProvider } from '@/components/portal/DivisionDirectory';
import { getDivisions } from '@/lib/members/divisions';
import { accentOf } from '@/lib/divisions/accent';
import { createServiceClient } from '@/lib/supabase/admin';
import { bannerShown, loadSiteSettings } from '@/lib/portal/siteSettings';

const CHECKIN_PATHS = ['/portal/in/', '/portal/finish-profile'];
import styles from './portal.module.css';
import { pacificDayKey } from '@/lib/core/timezone';

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
  const [roles, gender, viewAs, viewing, siteSettings, divisions] = await Promise.all([
    getUserRoles(),
    getMyGender(),
    getViewAs(),
    getViewingUser(),
    loadSiteSettings(createServiceClient()),
    getDivisions(),
  ]);
  const viewingName = viewing ? profile.display_name || profile.google_first_name || viewing.email || 'this person' : null;
  const isUcsdMember = isVerifiedMember(roles);
  const missingProfileFields = getMissingProfileFields({ ...profile, gender }, isUcsdMember, { requireOrgTitle: requiresOrgTitle(roles) });
  // Only the officer title missing -> send them straight to the Officer Card tab.
  const missingOnlyOfficerTab = missingProfileFields.length > 0 && getMissingProfileFields({ ...profile, gender }, isUcsdMember).length === 0;

  return (
    <SiteSettingsProvider value={siteSettings}>
      <DivisionDirectoryProvider value={divisions.map((d) => ({ id: d.id, name: d.name, slug: d.slug, accent: accentOf(d.accent).hex }))}>
        <div className={`${styles.layout} ${styles.fontScope} ${portalSans.variable} ${jbMono.variable}`} data-portal-layout>
          <main className={styles.main} data-ptr-page>
            {viewAs && (
              <div className={styles.bannerSlot}>
                <ViewAsBanner active={viewAs} />
              </div>
            )}
            {viewingName && (
              <div className={styles.bannerSlot}>
                <ViewingUserBanner name={viewingName} />
              </div>
            )}
            <SessionGuard />
            {viewingName && <ViewOnlyGuard name={viewingName} />}
            <div className={styles.content}>
              <div data-print-hide className={styles.bannerSlot} style={{ display: 'contents' }}>
                {bannerShown(siteSettings, pacificDayKey()) && <PortalBanner text={siteSettings.banner.text} />}
                <Suspense fallback={null}>
                  <HideOnPaths paths={CHECKIN_PATHS}>
                    <ProfileIncompleteBanner missing={missingProfileFields} officerTabOnly={missingOnlyOfficerTab} />
                    {!viewingName && <LinkAccountBanner />}
                  </HideOnPaths>
                </Suspense>
              </div>
              {children}
            </div>
          </main>
          {/* Fixed to the viewport, not slotted into .content — needs to stay
          reachable on /portal itself, which is the one page PortalTopbar
          (the other persistent portal chrome) deliberately hides on. */}
          <div data-print-hide style={{ display: 'contents' }}>
            <div className={styles.fixedBell} style={{ display: 'contents' }}>
              <HideOnPaths paths={CHECKIN_PATHS}>
                <NotificationBell />
              </HideOnPaths>
            </div>
            {/* Phones: the light/dark switch sits right beside the bell (desktop has it in the top bar). */}
            <HideOnPaths paths={CHECKIN_PATHS}>
              <div className={styles.fixedTheme}>
                <PortalThemeToggle />
              </div>
            </HideOnPaths>
            {/* Phones: the Enter A Code button, left of the light/dark switch (a computer has the code box in the sidebar, or this button in the top bar when the sidebar is hidden). */}
            <HideOnPaths paths={CHECKIN_PATHS}>
              <div className={styles.fixedSite}>
                <MainSiteLink round />
              </div>
              <div className={styles.fixedCode}>
                <CodeButton />
              </div>
            </HideOnPaths>
            <PullToRefresh />
            <ConnectivityBanner />
            <HideOnPaths paths={CHECKIN_PATHS}>
              <InstallAsk />
            </HideOnPaths>
            <AttributionCapture />
          </div>
        </div>
      </DivisionDirectoryProvider>
    </SiteSettingsProvider>
  );
}
