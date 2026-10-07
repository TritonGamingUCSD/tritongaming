'use client';

import { useCallback, useRef } from 'react';
import { usePortalParams, useLiveParams } from '@/lib/usePortalParams';

// Write half of deep-linking for a section's tabs: call the returned function when a tab (or sub-tab)
// is picked so the address reads /portal/<section>/<tab>/<subtab> and a copied link reopens exactly there.
// Anything that belonged to the previous tab (an open item, a search) is cleared.
//
// A section's first tab is the section itself: /portal/<section> with no tab, so the main page keeps the short address.
// Sections whose first tab depends on the person pass a function that says which one it is.
const MAIN_TAB: Record<string, string> = {
  tickets: 'tickets', admin: 'overview', profile: 'info', events: 'list', checkin: 'tickets', 'internal-events': 'coming-up', points: 'mine', meetings: 'mine', members: 'members',
};

export function usePortalTabSync(sectionId: string, firstTab?: () => string | undefined) {
  const setParams = usePortalParams();
  const firstRef = useRef(firstTab);
  firstRef.current = firstTab;

  return useCallback((tab: string, subtab?: string | null) => {
    const main = firstRef.current ? firstRef.current() : MAIN_TAB[sectionId];
    const isMain = tab === main && !subtab;
    setParams({
      section: sectionId,
      tab: isMain ? null : tab,
      subtab: subtab ?? null,
      block: null, id: null, q: null, status: null, view: null, atype: null, aq: null, aaction: null, arange: null, afrom: null, ato: null, ticket: null, plan: null,
    });
  }, [setParams, sectionId]);
}

// Where a section should start: read from the URL each time the section mounts (not from props the
// server computed once at page load). Sections swap in and out without a server round trip, so a prop
// would go stale. A link that names a tab wins; with no tab in the address a section always opens on its first tab,
// and each section still checks the tab is one they may use before showing it.
export function useUrlNav(): { tab: string | undefined; subtab: string | undefined } {
  const sp = useLiveParams();
  return { tab: sp.get('tab') ?? undefined, subtab: sp.get('subtab') ?? undefined };
}
