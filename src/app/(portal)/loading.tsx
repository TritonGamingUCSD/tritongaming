import PageLoading from '@/components/Loading/PageLoading';

// Placed at the outer (portal) route group, not the inner portal/ one: portal/layout.tsx itself does an `await getProfile()` auth check before
// rendering anything, and a loading.tsx only wraps what is below the segment it lives in. One level up covers that auth check too.
export default function PortalLoading() {
  return <PageLoading area="portal" label="Opening your portal…" />;
}
