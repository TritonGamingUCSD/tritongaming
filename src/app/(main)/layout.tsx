import { Suspense } from 'react';
import NavBar from '@/components/NavBar/NavBar';
import Footer from '@/components/Footer/Footer';
import AnnouncementBanner from '@/components/AnnouncementBanner/AnnouncementBanner';
import AttributionCapture from '@/components/AttributionCapture/AttributionCapture';
import ConnectivityBanner from '@/components/ConnectivityBanner/ConnectivityBanner';
import SmoothScroll from '@/components/SmoothScroll/SmoothScroll';

// The announcement is a flat strip at the very top of the page (in the flow, scrolls away).
// The fixed nav follows it via --banner-offset (see AnnouncementClient), so the two never overlap.
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
      <SmoothScroll />
      <Suspense fallback={null}>
        <AnnouncementBanner />
      </Suspense>
      <NavBar />
      <main>{children}</main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      <ConnectivityBanner />
      <AttributionCapture />
    </>
  );
}
