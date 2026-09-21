'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// The read half of deep-linking (initialTab/initialSubTab props, parsed
// from the URL on first render) already exists on every SectionContent
// below — this is the write half, which was missing: clicking a tab or
// sub-tab only ever updated local useState, so the URL stayed frozen at
// whatever it was when the section was opened (usually just
// /portal?section=<id>) and a copied link never reproduced where you
// actually were. Call the returned function from a tab's onClick alongside
// its setState call. router.replace (not push) — switching tabs within an
// already-open section isn't a new "place" for back/forward purposes, only
// opening/closing the section itself is (see PortalHub's own open/close).
export function usePortalTabSync(sectionId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return useCallback((tab: string, subtab?: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', sectionId);
    params.set('tab', tab);
    if (subtab) params.set('subtab', subtab);
    else params.delete('subtab');
    router.replace(`/portal?${params.toString()}`, { scroll: false });
  }, [router, searchParams, sectionId]);
}
