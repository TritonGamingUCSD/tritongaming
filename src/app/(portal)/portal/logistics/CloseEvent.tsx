'use client';

import { useState, type ReactNode } from 'react';
import { CloseEventDialog } from './PrizingDialogs';
import type { usePlanList } from './usePlans';

// Closing an event from any page. Closing takes out of stock what went out and was not counted back; when some lines were never counted back the server says which and the person says what happened
// to them (a small dialog). Reopening puts it back. `after` runs when the status really changed (so the page can read the event and the stock again).
export function useCloseEvent(list: ReturnType<typeof usePlanList>, after: () => void): { close: (p: { id: string; name: string }) => Promise<void>; reopen: (id: string) => Promise<void>; dialog: ReactNode } {
  const [asking, setAsking] = useState<null | { plan: { id: string; name: string }; lines: { station: string; prize: string; quantity: number }[]; busy: boolean }>(null);
  async function close(plan: { id: string; name: string }, how?: 'returned' | 'given') {
    const r = await list.close(plan.id, how);
    if (r.ok) { setAsking(null); after(); return; }
    if (r.uncounted?.length) { setAsking({ plan, lines: r.uncounted, busy: false }); return; }
    setAsking(null);
    list.setError(r.error);
  }
  async function reopen(id: string) { if (await list.update(id, { status: 'draft' })) after(); }
  const dialog = asking ? <CloseEventDialog name={asking.plan.name} lines={asking.lines} busy={asking.busy} onChoose={(how) => { setAsking({ ...asking, busy: true }); void close(asking.plan, how); }} onClose={() => setAsking(null)} /> : null;
  return { close: (p) => close(p), reopen, dialog };
}
