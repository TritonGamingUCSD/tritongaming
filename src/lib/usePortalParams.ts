'use client';

import { useCallback } from 'react';

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
