'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrizePatch, StockLevel } from '@/lib/logistics/prizes';
import { showToast } from '@/lib/ui/toast';
import { call } from '@/lib/ui/apiCall';

// A prize as the screens show it: the inventory row (quantity is how many are on hand) plus what open events have promised and what is left to promise.
export interface PrizeRow {
  id: string;
  name: string;
  sponsor_id: string | null;
  size: string | null;
  type: string | null;
  in_hand: boolean;
  price: number | null;
  quantity: number;
  quantity_is_estimate: boolean;
  stock_level: StockLevel;
  photo: string;
  bin: string | null;
  source: string | null;
  from_event: string | null;
  from_plan_id: string | null;
  expires_on: string | null;
  notes: string | null;
  allocated: number;
  staffle: number;
  left: number;
  used_at: string[]; // used_at: the events it has been put on a station of
}

// The prizes are read when the Prizes tab (or a plan's prize picker) opens and kept in memory; each edit's reply is applied on screen. Shown from memory for a minute, then refreshed once.
const FRESH_MS = 60_000;
let kept: { at: number; rows: PrizeRow[]; channel: string | null } | null = null;
let gen = 0; // counts the edits made on screen: a refresh already on its way when someone edited holds the old value and is dropped

export function usePrizes() {
  const [rows, setRows] = useState<PrizeRow[] | null>(kept?.rows ?? null);
  const [error, setError] = useState('');
  const loading = useRef(false);
  const [channel, setChannel] = useState<string | null>(kept?.channel ?? null);
  const put = useCallback((next: PrizeRow[], ch?: string | null) => {
    kept = { at: Date.now(), rows: next, channel: ch ?? kept?.channel ?? null };
    setRows(next);
    if (ch) setChannel(ch);
  }, []);
  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const g = gen;
    const r = await call<{ prizes: PrizeRow[]; channel?: string }>('/api/logistics/prizes', 'GET');
    loading.current = false;
    if (r.ok && g !== gen) return;
    if (r.ok) {
      put(r.data.prizes, r.data.channel);
      setError('');
    } else if (!kept) setError(r.error);
  }, [put]);
  useEffect(() => {
    if (!kept || Date.now() - kept.at > FRESH_MS) void load();
  }, [load]);

  // `expected_quantity` is the count the person was looking at; if someone else changed it first the server refuses, says who and what it is now, and the row shows that.
  const save = useCallback(
    async (id: string | null, patch: PrizePatch & { note?: string; expected_quantity?: number }): Promise<PrizeRow | null> => {
      const r = id ? await call<{ prize: PrizeRow }>(`/api/logistics/prizes/${id}`, 'PATCH', patch) : await call<{ prize: PrizeRow }>('/api/logistics/prizes', 'POST', patch);
      if (!r.ok) {
        if (r.body?.code === 'changed' && id) {
          gen++;
          put(
            (kept?.rows ?? []).map((x) => (x.id === id ? { ...x, quantity: r.body!.current ?? x.quantity, left: (r.body!.current ?? x.quantity) - x.allocated - x.staffle } : x)),
          );
          showToast(`${r.error} It shows ${r.body.current ?? 0} now.`);
          return null;
        }
        setError(r.error);
        return null;
      }
      setError('');
      const next = id ? (kept?.rows ?? []).map((x) => (x.id === id ? { ...x, ...r.data.prize } : x)) : [...(kept?.rows ?? []), r.data.prize];
      gen++;
      put(next.sort((a, b) => a.name.localeCompare(b.name)));
      return r.data.prize;
    },
    [put],
  );
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const r = await call<{ ok: true }>(`/api/logistics/prizes/${id}`, 'DELETE');
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      gen++;
      put((kept?.rows ?? []).filter((x) => x.id !== id));
      return true;
    },
    [put],
  );
  // A pool's number for a prize changed by `delta` somewhere else on screen: promised and left follow without asking the server again.
  const bump = useCallback(
    (id: string, delta: number) => {
      if (kept) {
        gen++;
        put(kept.rows.map((x) => (x.id === id ? { ...x, allocated: x.allocated + delta, left: x.left - delta } : x)));
      }
    },
    [put],
  );
  // Someone else's change to the number on hand, applied as it happens.
  const applyStock = useCallback(
    (id: string, qty: number) => {
      if (kept) {
        gen++;
        put(kept.rows.map((x) => (x.id === id ? { ...x, quantity: qty, left: qty - x.allocated - x.staffle } : x)));
      }
    },
    [put],
  );
  // One picture per prize (a small WebP made in the browser): set it, or remove it.
  const setPhoto = useCallback(
    async (id: string, blob: Blob): Promise<boolean> => {
      const form = new FormData();
      form.append('file', blob, 'photo.webp');
      try {
        const r = await fetch(`/api/logistics/prizes/${id}/photo`, { method: 'POST', body: form });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(j.error || 'Couldn’t save the picture.');
          return false;
        }
        gen++;
        put((kept?.rows ?? []).map((x) => (x.id === id ? { ...x, photo: j.photo as string } : x)));
        return true;
      } catch {
        setError('Couldn’t reach the server.');
        return false;
      }
    },
    [put],
  );
  const clearPhoto = useCallback(
    async (id: string): Promise<boolean> => {
      const r = await call<{ photo: string }>(`/api/logistics/prizes/${id}/photo`, 'DELETE');
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      gen++;
      put((kept?.rows ?? []).map((x) => (x.id === id ? { ...x, photo: '' } : x)));
      return true;
    },
    [put],
  );
  return { rows, error, setError, reload: load, save, remove, setPhoto, clearPhoto, bump, applyStock, channel };
}
export type PrizesApi = ReturnType<typeof usePrizes>;
