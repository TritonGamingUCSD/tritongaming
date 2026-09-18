import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

// Covers every page under the public-site route group (home, about,
// events, divisions, sponsors, get-involved, our-story) — nav and footer
// render immediately regardless (see (main)/layout.tsx, where both async
// pieces are wrapped in their own Suspense so they can never block this),
// this only fills the page's own content area while its data loads.
export default function MainLoading() {
  return <LoadingSpinner size={36} label="Loading…" theme="light" fullHeight />;
}
