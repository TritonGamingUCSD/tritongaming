import LogoLoader from '@/components/LogoLoader/LogoLoader';

// Placed at the outer (portal) route group, not the inner portal/ one —
// portal/layout.tsx itself does an `await getProfile()` auth check before
// rendering anything, and a loading.tsx only creates a Suspense boundary
// around what's *below* the segment it lives in. One level up here means
// this covers that auth check too, not just each page's own data fetch —
// otherwise a slow auth lookup would show a blank screen with no
// indication anything is happening before the page-level fallback even
// gets a chance to render.
export default function PortalLoading() {
  return (
    <div style={{ minHeight: '100vh', background: '#080d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LogoLoader size={96} label="Loading your portal…" theme="dark" />
    </div>
  );
}
