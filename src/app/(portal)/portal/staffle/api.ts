import type { StaffleView } from '@/lib/staffle/detail';

export type { StaffleView };
export type StaffleState = StaffleView['state'];
export interface StaffleCard { id: string; slug: string; name: string; opens_at: string; closes_at: string; state: StaffleState; items: number; photos: string[]; entered: number; won: number }

export async function call<T>(url: string, method = 'GET', body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, data: j as T } : { ok: false, error: (j as { error?: string }).error || 'Something went wrong.' };
  } catch { return { ok: false, error: 'Couldn’t reach the server.' }; }
}

// Times are shown in Pacific time, whatever the screen's own clock says.
export const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const STATE_LABEL: Record<StaffleState, string> = { scheduled: 'Opens soon', open: 'Open', closed: 'Closed, waiting for the draw', drawn: 'Drawn', ended: 'Ended', cancelled: 'Cancelled' };
