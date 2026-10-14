import PageLoading from '@/components/Loading/PageLoading';

// The outermost Suspense fallback Next.js has: only shown for the brief moment before routing has worked out which area (public site, portal or
// sign-in) is loading, so it picks the portal's or the site's look from the address. It is the same loader as every other loading screen.
export default function RootLoading() {
  return <PageLoading area="auto" fixed label="Loading Triton Gaming…" />;
}
