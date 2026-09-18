import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

// The outermost Suspense fallback Next.js has — only ever shown for the
// brief moment before routing even resolves which route group (main site,
// portal, or auth) is loading, so it can't assume any of their specific
// styling. Its own solid background means a slow connection shows a
// deliberate branded loading screen instead of a blank white flash while
// the very first byte of real content is still in flight.
export default function RootLoading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#080d1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LoadingSpinner size={40} label="Loading Triton Gaming…" theme="dark" />
    </div>
  );
}
