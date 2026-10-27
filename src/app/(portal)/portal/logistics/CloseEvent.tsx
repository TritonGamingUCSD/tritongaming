'use client';

import type { usePlanList } from './usePlans';

// Closing an event from any page. Closing changes no stock: what was given out left stock as it was counted, and what was neither given out nor counted back simply stays in stock (a closed event holds nothing).
// `after` runs when the status really changed (so the page can read the event and the stock again).
export function useCloseEvent(list: ReturnType<typeof usePlanList>, after: () => void): { close: (p: { id: string; name: string }) => Promise<void>; reopen: (id: string) => Promise<void> } {
  async function close(plan: { id: string }) {
    const r = await list.close(plan.id);
    if (r.ok) after(); else list.setError(r.error);
  }
  async function reopen(id: string) { if (await list.update(id, { status: 'draft' })) after(); }
  return { close, reopen };
}
