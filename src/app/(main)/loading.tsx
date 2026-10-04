import ZineLoader from '@/components/ZineLoader/ZineLoader';

// Covers every page under the public-site route group. The nav and footer render immediately (see (main)/layout.tsx), so this only fills the
// page's own area while its data loads.
export default function MainLoading() {
  return <ZineLoader label="Loading page…" />;
}
