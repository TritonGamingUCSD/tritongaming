import PageLoading from '@/components/Loading/PageLoading';

// Covers every page under the public-site route group. The nav and footer render immediately (see (main)/layout.tsx), so this only fills the
// page's own area while its data loads.
export default function MainLoading() {
  return <PageLoading area="site" label="Loading page…" />;
}
