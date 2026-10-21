'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Device } from '@/lib/logistics/devices';
import type { Conflict, StepDef } from '@/lib/logistics/plans';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';

export interface PlanSummary { id: string; slug: string; name: string; event_id: string | null; starts_on: string; ends_on: string; status: 'draft' | 'closed'; notes: string | null; devices: number }
export interface Station { id: string; name: string; sort: number; contact: string | null; room: string | null; confirmed: boolean }
// A row allocated by type that has no device yet (or never will: a mousepad). `label` is a note shown with it.
export interface Slot { id: string; plan_id: string; station_id: string | null; type: string; games: string[]; label: string | null; sort: number; set_id?: string | null }
export interface PlanItem { device_id: string; station_id: string | null; role: 'planned' | 'backup'; swap_reason: string | null; swapped_for_label: string | null; games_needed: string[]; sort: number; set_id?: string | null; device: Device }
export interface KitLine { item: string; qty: number; missing: boolean }
// A sponsor's or an officer's device, entered inside this one event (not in the inventory). `owner` is their name in words.
export interface Borrowed { id: string; plan_id: string; tag: string; name: string | null; type: string; owner_kind: 'sponsor' | 'officer'; sponsor_id: string | null; owner_user_id: string | null; owner_note: string | null; station_id: string | null; role: 'planned' | 'backup'; swap_reason: string | null; swapped_for_label: string | null; kit: KitLine[]; notes: string | null; games_needed: string[]; sort: number; set_id?: string | null; owner: string }
export interface DoneRow { device_id?: string | null; borrowed_id?: string | null; slot_id?: string | null; step_id: string; done_at: string }
export const doneKey = (d: { device_id?: string | null; borrowed_id?: string | null; slot_id?: string | null; step_id: string }) => `${d.device_id ?? d.borrowed_id ?? d.slot_id}:${d.step_id}`;
export interface PlanDetail {
  plan: Omit<PlanSummary, 'devices'> & { updated_at: string }; canManage: boolean; stations: Station[]; steps: StepDef[]; items: PlanItem[]; borrowed: Borrowed[]; slots: Slot[]; extras: Device[]; done: DoneRow[]; conflicts: Conflict[];
}
// What the event-day screen shows about anything in a plan.
export interface Slim { id: string; kind: 'club' | 'sponsor' | 'officer' | 'slot'; games_needed?: string[]; label?: string | null; tag: string | null; name: string | null; type: string; shelf: string | null; tier: string | null; place_note: string | null; owner: string | null; condition: string | null; kit: KitLine[] }
export interface StepResult { item: Slim; inPlan: boolean; role: string | null; station: { id: string; name: string } | null; already: boolean; done_at: string; step_id: string }

async function call<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error || 'Something went wrong.', status: r.status };
    return { ok: true, data: j as T };
  } catch { return { ok: false, error: 'Couldn’t reach the server.', status: 0 }; }
}

// The list of plans.
export function usePlanList() {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [today, setToday] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await call<{ plans: PlanSummary[]; today: string }>('/api/logistics/plans', 'GET');
    if (r.ok) { setPlans(r.data.plans); setToday(r.data.today); setError(''); } else setError(r.error);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const create = useCallback(async (body: Record<string, unknown>) => {
    const r = await call<{ plan: PlanSummary }>('/api/logistics/plans', 'POST', body);
    if (!r.ok) { setError(r.error); return null; }
    setPlans((p) => [r.data.plan, ...(p ?? [])]);
    return r.data.plan;
  }, []);
  const events = useCallback(async (past: boolean) => {
    const r = await call<{ events: { id: string; title: string; starts_on: string | null; ends_on: string | null }[] }>(`/api/logistics/plans?events=1${past ? '&past=1' : ''}`, 'GET');
    return r.ok ? r.data.events : [];
  }, []);
  return { plans, today, error, setError, reload: load, create, events };
}

// One plan. Structural changes (devices, stations, status) are made and then the plan is read again; steps are applied on screen straight away. While the event-day screen is
// open it asks a tiny question every minute (only while the tab is visible) and applies what other phones did.
export function usePlan(id: string, live: boolean) {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [error, setError] = useState('');
  const since = useRef('');
  const stamp = useRef('');

  const load = useCallback(async () => {
    const r = await call<PlanDetail>(`/api/logistics/plans/${id}`, 'GET');
    if (!r.ok) { setError(r.error); return false; }
    setDetail(r.data); setError('');
    stamp.current = r.data.plan.updated_at;
    since.current = r.data.done.reduce((m, d) => (d.done_at > m ? d.done_at : m), '');
    return true;
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const check = useCallback(async () => {
    const q = since.current ? `?since=${encodeURIComponent(since.current)}` : '';
    const r = await call<{ updated_at: string; status: string; count: number; changes: DoneRow[] }>(`/api/logistics/plans/${id}/version${q}`, 'GET');
    if (!r.ok) return;
    setDetail((cur) => {
      if (!cur) return cur;
      const have = new Set(cur.done.map(doneKey));
      const fresh = r.data.changes.filter((c) => !have.has(doneKey(c)));
      const done = [...cur.done, ...fresh];
      if (r.data.changes.length) since.current = r.data.changes.reduce((m, d) => (d.done_at > m ? d.done_at : m), since.current);
      // Something else changed (devices, stations, a swap, a step undone elsewhere): read the whole plan again.
      if (r.data.updated_at !== stamp.current || r.data.count !== done.length) { void load(); return fresh.length ? { ...cur, done } : cur; }
      return fresh.length ? { ...cur, done } : cur;
    });
  }, [id, load]);
  useVisiblePoll(check, 60_000, live);

  const act = useCallback(async (url: string, method: string, body?: unknown): Promise<boolean> => {
    const r = await call<unknown>(`/api/logistics/plans/${id}${url}`, method, body);
    if (!r.ok) { setError(r.error); return false; }
    setError('');
    await load();
    return true;
  }, [id, load]);

  // ---- steps (applied on screen)
  const doStep = useCallback(async (body: { tag?: string; device_id?: string; borrowed_id?: string; slot_id?: string; step_id: string; kit?: { item: string; missing: boolean }[] }): Promise<{ ok: true; result: StepResult } | { ok: false; error: string }> => {
    const r = await call<StepResult>(`/api/logistics/plans/${id}/steps`, 'POST', body);
    if (!r.ok) return { ok: false, error: r.error };
    const res = r.data;
    setDetail((cur) => {
      if (!cur) return cur;
      const club = res.item.kind === 'club';
      const row: DoneRow = club ? { device_id: res.item.id, step_id: res.step_id, done_at: res.done_at } : res.item.kind === 'slot' ? { slot_id: res.item.id, step_id: res.step_id, done_at: res.done_at } : { borrowed_id: res.item.id, step_id: res.step_id, done_at: res.done_at };
      const done = cur.done.some((d) => doneKey(d) === doneKey(row)) ? cur.done : [...cur.done, row];
      if (res.done_at > since.current) since.current = res.done_at;
      // The parts may have changed at Check done; a club device not in the plan is remembered as a spare used on the day.
      const items = club ? cur.items.map((i) => (i.device_id === res.item.id ? { ...i, device: { ...i.device, kit: res.item.kit } } : i)) : cur.items;
      const borrowed = club || res.item.kind === 'slot' ? cur.borrowed : cur.borrowed.map((b) => (b.id === res.item.id ? { ...b, kit: res.item.kit } : b));
      const extras = res.item.kind !== 'club' || res.inPlan || cur.extras.some((e) => e.id === res.item.id) ? cur.extras : [...cur.extras, res.item as unknown as Device];
      return { ...cur, done, extras, items, borrowed };
    });
    return { ok: true, result: res };
  }, [id]);
  const undoStep = useCallback(async (item: { id: string; kind: 'club' | 'sponsor' | 'officer' | 'slot' }, step_id: string): Promise<boolean> => {
    const r = await call<{ ok: true }>(`/api/logistics/plans/${id}/steps`, 'DELETE', { ...(item.kind === 'club' ? { device_id: item.id } : item.kind === 'slot' ? { slot_id: item.id } : { borrowed_id: item.id }), step_id });
    if (!r.ok) { setError(r.error); return false; }
    setDetail((cur) => (cur ? { ...cur, done: cur.done.filter((d) => !(((d.device_id ?? d.borrowed_id) === item.id) && d.step_id === step_id)) } : cur));
    return true;
  }, [id]);
  const swap = useCallback(async (body: { device_id?: string; borrowed_id?: string; replacement_tag: string; reason: string }) => {
    const r = await call<{ replacement: Slim; station: { id: string; name: string } | null }>(`/api/logistics/plans/${id}/swap`, 'POST', body);
    if (!r.ok) return { ok: false as const, error: r.error };
    await load();
    return { ok: true as const, replacement: r.data.replacement, station: r.data.station };
  }, [id, load]);
  const fill = useCallback(async (station_id: string | null, apply: boolean) => {
    const r = await call<{ preview: { slot_id: string; type: string; games: string[]; device: { id: string; tag: string | null; condition: string; games: string[] } | null }[] }>(`/api/logistics/plans/${id}/slots`, 'POST', { action: 'fill', station_id, apply });
    if (!r.ok) return { ok: false as const, error: r.error };
    if (apply) await load();
    return { ok: true as const, preview: r.data.preview };
  }, [id, load]);
  const assign = useCallback(async (slot_id: string, tag: string) => {
    const r = await call<{ ok: true }>(`/api/logistics/plans/${id}/slots`, 'POST', { action: 'assign', slot_id, tag });
    if (!r.ok) { setError(r.error); return false; }
    setError('');
    await load();
    return true;
  }, [id, load]);
  const pick = useCallback(async (body: Record<string, unknown>) => {
    const r = await call<{ preview: PickPreview; applied?: number }>(`/api/logistics/plans/${id}/pick`, 'POST', body);
    if (!r.ok) return { ok: false as const, error: r.error };
    if (body.apply) await load();
    return { ok: true as const, preview: r.data.preview, applied: r.data.applied ?? 0 };
  }, [id, load]);

  return { detail, error, setError, reload: load, act, doStep, undoStep, swap, pick, fill, assign };
}
export interface PickCell { type: string; games: string[]; counted: boolean; device: { id: string; tag: string | null; shelf: string | null; tier: string | null; condition: string } | null }
export interface PickPreview { stations: PickCell[][]; short: number | { type: string; missing: number }[]; notTested: number; missingGames: number; empty: number }
export type PlanApi = ReturnType<typeof usePlan>;
