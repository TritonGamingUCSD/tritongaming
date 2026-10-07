'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useServerPortalQuery } from '@/components/portal/PortalParamsContext';
import { useSearchParams } from 'next/navigation';
import { mergedPortalParams, portalHref } from '@/lib/portal/portalPath';

// Keeps the portal's URL in step with what's on screen (which tab, which doc, which filter…) so any
// view can be bookmarked or shared. Uses the browser history API directly rather than router.replace:
// the portal page is rendered on the server, and router.replace would re-fetch every section's data
// on each change. Next.js keeps useSearchParams() in sync with replaceState.
//
//   setParams({ tab: 'shop', subtab: null })  // null/'' removes a param
export function usePortalParams() {
  return useCallback((updates: Record<string, string | null | undefined>) => {
    const params = mergedPortalParams(window.location.pathname, window.location.search);
    // Moving to another section (or home) starts clean: nothing from the page you left (an open doc, a filter, a search)
    // may follow you, whatever key it used. Only what this call sets survives.
    if ('section' in updates && (updates.section || null) !== (params.get('section') || null)) {
      for (const key of [...params.keys()]) if (!(key in updates)) params.delete(key);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    }
    // A portal address (/portal/<section>/<tab>/<subtab>); anything else (a standalone page) keeps its own path.
    const onPortal = window.location.pathname === '/portal' || window.location.pathname.startsWith('/portal/');
    // Going home (section removed) is a portal address too: /portal, not whatever section's path the person was on.
    if (onPortal && (params.get('section') || window.location.pathname === '/portal' || 'section' in updates)) {
      // Opening a different section (or going home) is a real step in the browser's history, so Back returns to the previous
      // page; tabs, filters and typing only rewrite the current entry so they don't pile up.
      const target = portalHref(params);
      const current = `${window.location.pathname}${window.location.search}`;
      if ('section' in updates && target !== current) { window.history.pushState(window.history.state, '', target); (window as unknown as { __tgPush?: number }).__tgPush = ((window as unknown as { __tgPush?: number }).__tgPush ?? 0) + 1; }
      else window.history.replaceState(window.history.state, '', target);
    } else {
      const qs = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    }
  }, []);
}

// The current URL's params, read straight from the address bar once on the client. useSearchParams()
// alone can lag a moment behind a replaceState done in the same click (Next updates it a tick later),
// which made a freshly opened section start from the previous section's tab. Subscribing to
// useSearchParams keeps components re-rendering when the URL changes.
export function useLiveParams(): URLSearchParams {
  const subscribed = useSearchParams();
  const server = useServerPortalQuery();
  // False while the server HTML is being hydrated, true afterwards: reading the address bar during hydration would not match what the server drew.
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  return hydrated ? mergedPortalParams(window.location.pathname, window.location.search) : new URLSearchParams(server ?? subscribed.toString());
}
