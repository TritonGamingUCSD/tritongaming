'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// Keeps the portal's URL in step with what's on screen (which tab, which doc, which filter…) so any
// view can be bookmarked or shared. Uses the browser history API directly rather than router.replace:
// the portal page is rendered on the server, and router.replace would re-fetch every section's data
// on each change. Next.js keeps useSearchParams() in sync with replaceState.
//
//   setParams({ tab: 'shop', subtab: null })  // null/'' removes a param
export function usePortalParams() {
  return useCallback((updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);
}

// The current URL's params, read straight from the address bar once on the client. useSearchParams()
// alone can lag a moment behind a replaceState done in the same click (Next updates it a tick later),
// which made a freshly opened section start from the previous section's tab. Subscribing to
// useSearchParams keeps components re-rendering when the URL changes.
export function useLiveParams(): URLSearchParams {
  const subscribed = useSearchParams();
  return typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams(subscribed.toString());
}
