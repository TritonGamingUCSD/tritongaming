import { Suspense } from 'react';
import NavBar from '@/components/NavBar/NavBar';
import Footer from '@/components/Footer/Footer';
import AnnouncementBanner from '@/components/AnnouncementBanner/AnnouncementBanner';
import ConnectivityBanner from '@/components/ConnectivityBanner/ConnectivityBanner';

// NavBar and AnnouncementBanner are independent fixed elements now, not
// stacked together — the banner lives as its own floating toast in the
// bottom-right corner (see AnnouncementBanner.module.css) instead of
// pushing the nav pill down from the top, which used to shove the nav (and
// anything relying on the static --navbar-height clearance) down into
// page content whenever a banner was showing.
//
// Footer and AnnouncementBanner are both async server components (each
// does its own site_contents fetch) rendered here directly rather than
// through {children} — without their own Suspense boundaries, a slow fetch
// for either one blocks this *entire* layout from rendering anything at
// all, nav included, since neither is covered by the page's own
// loading.tsx (that only wraps {children}). Wrapping them individually
// means a slow footer/banner fetch only delays that one piece — the page
// people actually came to see still shows up immediately. Neither needs a
// visible fallback: a footer or a toast banner popping in a moment after
// the page is usable is normal, not a "something's broken" moment the way
// a blank nav would be.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      <Suspense fallback={null}>
        <AnnouncementBanner />
      </Suspense>
      <ConnectivityBanner />
    </>
  );
}
