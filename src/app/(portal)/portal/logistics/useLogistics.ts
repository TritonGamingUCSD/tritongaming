'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OptionKind } from '@/lib/logistics/constants';
import type { Device, DevicePatch } from '@/lib/logistics/devices';

export interface BundleItem { type: string; qty: number }
export interface OptionItem { id: string; value: string; counted?: boolean; main?: boolean; applies?: 'all' | 'club' | 'borrowed'; kit?: boolean; gives?: boolean; leftover?: boolean; items?: BundleItem[] }
export interface Sponsor { id: string; name: string; contact: string | null; notes: string | null }
export interface Catalog {
  canManage: boolean;
  lists: Record<OptionKind, OptionItem[]>;
  portalGames: string[];
  devices: Device[];
  sponsors: Sponsor[];
  todayPlans: { id: string; slug: string; name: string }[];
}

// The catalog is fetched once when the section opens (one request: devices, lists, sponsors together) and kept in memory. Each edit's reply is applied to what is already on screen,
// so nothing reloads after a change. Opening the section again within a minute shows what is kept without asking the server; after that it refreshes quietly once.
const FRESH_MS = 60_000;
let kept: { at: number; data: Catalog } | null = null;

async function call<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error || 'Something went wrong.' };
    return { ok: true, data: j as T };
  } catch { return { ok: false, error: 'Couldn’t reach the server.' }; }
}

export function useLogistics() {
  const [data, setData] = useState<Catalog | null>(kept?.data ?? null);
  const [error, setError] = useState('');
  const loading = useRef(false);

  const put = useCallback((next: Catalog) => { kept = { at: Date.now(), data: next }; setData(next); }, []);
  const edit = useCallback((fn: (d: Catalog) => Catalog) => setData((cur) => { if (!cur) return cur; const next = fn(cur); kept = { at: kept?.at ?? Date.now(), data: next }; return next; }), []);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const r = await call<Catalog>('/api/logistics', 'GET');
    loading.current = false;
    if (r.ok) { put(r.data); setError(''); } else if (!kept) setError(r.error);
  }, [put]);

  useEffect(() => { if (!kept || Date.now() - kept.at > FRESH_MS) void load(); }, [load]);

  // ---- devices
  // An edit to an existing device shows on screen straight away and is confirmed (or put back, with the reason) when the server answers.
  const saveDevice = useCallback(async (id: string | null, patch: DevicePatch): Promise<Device | null> => {
    let before: Device | undefined;
    if (id) edit((d) => ({ ...d, devices: d.devices.map((x) => { if (x.id !== id) return x; before = x; return { ...x, ...(patch as Partial<Device>) }; }) }));
    const r = id ? await call<{ device: Device }>(`/api/logistics/devices/${id}`, 'PATCH', patch) : await call<{ device: Device }>('/api/logistics/devices', 'POST', patch);
    if (!r.ok) {
      setError(r.error);
      if (id && before) { const old = before; edit((d) => ({ ...d, devices: d.devices.map((x) => (x.id === id ? old : x)) })); }
      return null;
    }
    setError('');
    edit((d) => ({ ...d, devices: id ? d.devices.map((x) => (x.id === id ? r.data.device : x)) : [...d.devices, r.data.device] }));
    return r.data.device;
  }, [edit]);
  const removeDevice = useCallback(async (id: string): Promise<boolean> => {
    const r = await call<{ ok: true }>(`/api/logistics/devices/${id}`, 'DELETE');
    if (!r.ok) { setError(r.error); return false; }
    edit((d) => ({ ...d, devices: d.devices.filter((x) => x.id !== id) }));
    return true;
  }, [edit]);

  // ---- dropdown lists
  const addOption = useCallback(async (kind: OptionKind, value: string, extra: Record<string, unknown> = {}): Promise<string | null> => {
    const r = await call<{ option: OptionItem }>('/api/logistics/options', 'POST', { kind, value, ...extra });
    if (!r.ok) { setError(r.error); return null; }
    edit((d) => (d.lists[kind].some((o) => o.id === r.data.option.id) ? d : { ...d, lists: { ...d.lists, [kind]: [...d.lists[kind], r.data.option] } }));
    return r.data.option.value;
  }, [edit]);
  const changeOption = useCallback(async (id: string, patch: { value?: string; counted?: boolean; main?: boolean; applies?: string; kit?: boolean; gives?: boolean; leftover?: boolean; items?: BundleItem[]; move?: 'up' | 'down' }): Promise<boolean> => {
    const r = await call<{ ok: true }>('/api/logistics/options', 'PATCH', { id, ...patch });
    if (!r.ok) { setError(r.error); return false; }
    setError('');
    // A rename (devices that used the old name follow it), a step's order or settings, and a bundle's items are read again; a counted switch is applied on screen.
    if (patch.value !== undefined || patch.applies !== undefined || patch.kit !== undefined || patch.gives !== undefined || patch.leftover !== undefined || patch.items !== undefined || patch.move !== undefined) await load();
    else edit((d) => ({ ...d, lists: Object.fromEntries(Object.entries(d.lists).map(([k, v]) => [k, v.map((o) => (o.id === id ? { ...o, ...(patch.counted !== undefined ? { counted: patch.counted } : {}), ...(patch.main !== undefined ? { main: patch.main } : {}) } : o))])) as Catalog['lists'] }));
    return true;
  }, [edit, load]);
  const deleteOption = useCallback(async (kind: OptionKind, id: string): Promise<boolean> => {
    const r = await call<{ ok: true }>('/api/logistics/options', 'DELETE', { id });
    if (!r.ok) { setError(r.error); return false; }
    setError('');
    edit((d) => ({ ...d, lists: { ...d.lists, [kind]: d.lists[kind].filter((o) => o.id !== id) } }));
    return true;
  }, [edit]);

  // ---- sponsors
  const saveSponsor = useCallback(async (id: string | null, v: { name?: string; contact?: string | null; notes?: string | null }): Promise<Sponsor | null> => {
    const r = id ? await call<{ sponsor: Sponsor }>('/api/logistics/sponsors', 'PATCH', { id, ...v }) : await call<{ sponsor: Sponsor }>('/api/logistics/sponsors', 'POST', v);
    if (!r.ok) { setError(r.error); return null; }
    setError('');
    edit((d) => ({ ...d, sponsors: (id ? d.sponsors.map((s) => (s.id === id ? r.data.sponsor : s)) : d.sponsors.some((s) => s.id === r.data.sponsor.id) ? d.sponsors : [...d.sponsors, r.data.sponsor]).sort((a, b) => a.name.localeCompare(b.name)) }));
    return r.data.sponsor;
  }, [edit]);
  const deleteSponsor = useCallback(async (id: string): Promise<boolean> => {
    const r = await call<{ ok: true }>('/api/logistics/sponsors', 'DELETE', { id });
    if (!r.ok) { setError(r.error); return false; }
    edit((d) => ({ ...d, sponsors: d.sponsors.filter((s) => s.id !== id) }));
    return true;
  }, [edit]);

  // Loaner owners and device history are fetched only when someone asks.
  const loadPeople = useCallback(async () => { const r = await call<{ people: { id: string; name: string }[] }>('/api/logistics/people', 'GET'); return r.ok ? r.data.people : []; }, []);
  const loadHistory = useCallback(async (id: string) => { const r = await call<{ log: { id: string; at: string; summary: string; by: string | null }[] }>(`/api/logistics/devices/${id}`, 'GET'); return r.ok ? r.data.log : null; }, []);

  return { data, error, setError, saveDevice, removeDevice, addOption, changeOption, deleteOption, saveSponsor, deleteSponsor, loadPeople, loadHistory };
}
export type LogisticsApi = ReturnType<typeof useLogistics>;
