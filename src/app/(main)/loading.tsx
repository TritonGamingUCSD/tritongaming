import LogoLoader from '@/components/LogoLoader/LogoLoader';

// Covers every page under the public-site route group (home, about,
// events, divisions, sponsors, get-involved, our-story) — nav and footer
// render immediately regardless (see (main)/layout.tsx, where both async
// pieces are wrapped in their own Suspense so they can never block this),
// this only fills the page's own content area while its data loads.
// theme="dark": the site's body background is dark navy (#060c1a in
// globals.css) everywhere, not light/white — "light" here would mean dark
// navy label text sitting directly on that same dark navy background.
export default function MainLoading() {
  return <LogoLoader size={80} label="Loading…" theme="dark" fullHeight />;
}
