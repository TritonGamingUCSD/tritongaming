'use client';

import { useCallback } from 'react';
import { usePortalParams, useLiveParams } from '@/lib/usePortalParams';

// Write half of deep-linking for a section's tabs: call the returned function when a tab (or sub-tab)
// is picked so the URL reads /portal?section=<id>&tab=<tab>&subtab=<subtab> and a copied link reopens
// exactly there. Anything that belonged to the previous tab (an open item, a search) is cleared.
//
// It also remembers the pick for next time (per section, on this device): see useUrlNav.
const KEY = (section: string) => `tg:last-tab:${section}`;
function remember(section: string, tab: string, subtab: string | null) {
  try { window.localStorage.setItem(KEY(section), JSON.stringify({ tab, subtab })); } catch { /* private mode or blocked storage: just don't remember */ }
}
function recall(section: string): { tab: string; subtab: string | null } | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY(section)) ?? 'null');
    return v && typeof v.tab === 'string' ? { tab: v.tab, subtab: typeof v.subtab === 'string' ? v.subtab : null } : null;
  } catch { return null; }
}

export function usePortalTabSync(sectionId: string) {
  const setParams = usePortalParams();

  return useCallback((tab: string, subtab?: string | null) => {
    remember(sectionId, tab, subtab ?? null);
    setParams({
      section: sectionId,
      tab,
      subtab: subtab ?? null,
      block: null, id: null, q: null, status: null, view: null, atype: null, aq: null, ticket: null, plan: null,
    });
  }, [setParams, sectionId]);
}

// Where a section should start: read from the URL each time the section mounts (not from props the
// server computed once at page load). Sections swap in and out without a server round trip, so a prop
// would go stale — e.g. reopening Rewards would jump back to the tab the page originally loaded on.
//
// A link that names a tab always wins. With no tab in the address, the section opens where this person last was (each section keeps its own),
// and each section still checks the tab is one they may use before showing it.
export function useUrlNav(): { tab: string | undefined; subtab: string | undefined } {
  const sp = useLiveParams();
  const tab = sp.get('tab') ?? undefined;
  if (tab) return { tab, subtab: sp.get('subtab') ?? undefined };
  const section = sp.get('section');
  const last = section && typeof window !== 'undefined' ? recall(section) : null;
  return { tab: last?.tab, subtab: last?.subtab ?? undefined };
}
