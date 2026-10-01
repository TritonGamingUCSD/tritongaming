'use client';

import { useCallback } from 'react';
import { usePortalParams } from '@/lib/usePortalParams';

// Write half of deep-linking for a section's tabs: call the returned function when a tab (or sub-tab)
// is picked so the URL reads /portal?section=<id>&tab=<tab>&subtab=<subtab> and a copied link reopens
// exactly there. Anything that belonged to the previous tab (an open item, a search) is cleared.
export function usePortalTabSync(sectionId: string) {
  const setParams = usePortalParams();

  return useCallback((tab: string, subtab?: string | null) => {
    setParams({
      section: sectionId,
      tab,
      subtab: subtab ?? null,
      block: null, id: null, q: null, status: null, view: null, atype: null, aq: null,
    });
  }, [setParams, sectionId]);
}
