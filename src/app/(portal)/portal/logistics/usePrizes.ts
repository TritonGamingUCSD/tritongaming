'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrizePatch } from '@/lib/logistics/prizes';

// A prize as the screens show it: the inventory row plus what open plans hold, what has been given out, what is left, and the event it was sent for.
export interface PrizeRow {
  id: string; name: string; sponsor_id: string | null; size: string | null; type: string | null; price: number | null; quantity: number; quantity_is_estimate: boolean;
  shelf: string | null; tier: string | null; place_note: string | null; plan_id: string | null; expires_on: string | null; notes: string | null;
  allocated: number; given: number; left: number; event: string | null;
}

// The prizes are read when the Prizes tab (or a plan's prize picker) opens and kept in memory; each edit's reply is applied on screen. Shown from memory for a minute, then refreshed once.
const FRESH_MS = 60_000;
let kept: { at: number; rows: PrizeRow[] } | null = null;

async function call<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error || 'Something went wrong.' };
    return { ok: true, data: j as T };
  } catch { return { ok: false, error: 'Couldn’t reach the server.' }; }
}

export function usePrizes() {
  const [rows, setRows] = useState<PrizeRow[] | null>(kept?.rows ?? null);
  const [error, setError] = useState('');
  const loading = useRef(false);
  const put = useCallback((next: PrizeRow[]) => { kept = { at: Date.now(), rows: next }; setRows(next); }, []);
  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const r = await call<{ prizes: PrizeRow[] }>('/api/logistics/prizes', 'GET');
    loading.current = false;
    if (r.ok) { put(r.data.prizes); setError(''); } else if (!kept) setError(r.error);
  }, [put]);
  useEffect(() => { if (!kept || Date.now() - kept.at > FRESH_MS) void load(); }, [load]);

  const save = useCallback(async (id: string | null, patch: PrizePatch): Promise<PrizeRow | null> => {
    const r = id ? await call<{ prize: PrizeRow }>('/api/logistics/prizes', 'PATCH', { id, ...patch }) : await call<{ prize: PrizeRow }>('/api/logistics/prizes', 'POST', patch);
    if (!r.ok) { setError(r.error); return null; }
    setError('');
    const next = id ? (kept?.rows ?? []).map((x) => (x.id === id ? { ...x, ...r.data.prize } : x)) : [...(kept?.rows ?? []), r.data.prize];
    put(next.sort((a, b) => a.name.localeCompare(b.name)));
    return r.data.prize;
  }, [put]);
  const remove = useCallback(async (id: string): Promise<boolean> => {
    const r = await call<{ ok: true }>('/api/logistics/prizes', 'DELETE', { id });
    if (!r.ok) { setError(r.error); return false; }
    put((kept?.rows ?? []).filter((x) => x.id !== id));
    return true;
  }, [put]);
  // A pool's number for a prize changed by `delta` somewhere else on screen: promised and left follow without asking the server again.
  const bump = useCallback((id: string, delta: number) => { if (kept) put(kept.rows.map((x) => (x.id === id ? { ...x, allocated: x.allocated + delta, left: x.left - delta } : x))); }, [put]);
  return { rows, error, setError, reload: load, save, remove, bump };
}
export type PrizesApi = ReturnType<typeof usePrizes>;
