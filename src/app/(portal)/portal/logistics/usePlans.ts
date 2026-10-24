'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Device } from '@/lib/logistics/devices';
import type { Conflict, StepDef } from '@/lib/logistics/plans';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';

export interface PlanSummary { id: string; slug: string; name: string; event_id: string | null; starts_on: string; ends_on: string; status: 'draft' | 'closed'; manual_return?: boolean; notes: string | null; devices: number; empty: number; teams: number; requests: number; newRequests: number; prizes: number; prizeValue: number }
export interface Station { id: string; name: string; sort: number; contact: string | null; room: string | null }
// A row allocated by type that has no device yet (or never will: a mousepad). `label` is a note shown with it.
export interface Slot { id: string; plan_id: string; station_id: string | null; type: string; games: string[]; label: string | null; sort: number; set_id?: string | null; request_id?: string | null; request_item?: string | null }
export interface PlanItem { device_id: string; station_id: string | null; role: 'planned' | 'backup'; swap_reason: string | null; swapped_for_label: string | null; games_needed: string[]; games?: string[]; sort: number; set_id?: string | null; request_id?: string | null; request_item?: string | null; device: Device }
export interface KitLine { item: string; qty: number; missing: boolean }
// A sponsor's or an officer's device, entered inside this one event (not in the inventory). `owner` is their name in words.
export interface Borrowed { id: string; plan_id: string; tag: string; name: string | null; type: string; owner_kind: 'sponsor' | 'officer'; sponsor_id: string | null; owner_user_id: string | null; owner_note: string | null; station_id: string | null; role: 'planned' | 'backup'; swap_reason: string | null; swapped_for_label: string | null; kit: KitLine[]; notes: string | null; games_needed: string[]; games?: string[]; sort: number; set_id?: string | null; request_id?: string | null; request_item?: string | null; owner: string }
export interface DoneRow { device_id?: string | null; borrowed_id?: string | null; slot_id?: string | null; step_id: string; done_at: string; by?: string | null }
export const doneKey = (d: { device_id?: string | null; borrowed_id?: string | null; slot_id?: string | null; step_id: string }) => `${d.device_id ?? d.borrowed_id ?? d.slot_id}:${d.step_id}`;
export type PlanPrizesData = import('@/lib/logistics/prizeServer').PlanPrizes;
export interface PlanDetail {
  prizes: PlanPrizesData; lockedRequests: string[];   // requests whose allocation is locked
  plan: Omit<PlanSummary, 'devices'> & { updated_at: string }; canManage: boolean; stations: Station[]; steps: StepDef[]; items: PlanItem[]; borrowed: Borrowed[]; slots: Slot[]; extras: Device[]; done: DoneRow[]; conflicts: Conflict[];
}
// What the event-day screen shows about anything in a plan.
export interface Slim { id: string; kind: 'club' | 'sponsor' | 'officer' | 'slot'; games_needed?: string[]; label?: string | null; tag: string | null; name: string | null; type: string; shelf: string | null; tier: string | null; place_note: string | null; owner: string | null; condition: string | null; kit: KitLine[] }
export interface StepResult { item: Slim; inPlan: boolean; role: string | null; station: { id: string; name: string } | null; already: boolean; done_at: string; step_id: string; by?: string | null }

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
  const update = useCallback(async (id: string, body: Record<string, unknown>) => {
    const r = await call<{ plan: PlanSummary }>(`/api/logistics/plans/${id}`, 'PATCH', body);
    if (!r.ok) { setError(r.error); return false; }
    await load();
    return true;
  }, [load]);
  const remove = useCallback(async (id: string) => {
    const r = await call<{ ok: true }>(`/api/logistics/plans/${id}`, 'DELETE');
    if (!r.ok) { setError(r.error); return false; }
    setPlans((p) => (p ?? []).filter((x) => x.id !== id));
    return true;
  }, []);
  return { plans, today, error, setError, reload: load, create, update, remove, events };
}

// One plan. Structural changes (devices, stations, status) are made and then the plan is read again; steps are applied on screen straight away. While the event-day screen is
// open it asks a tiny question every 20 seconds (only while the tab is visible) and applies what other phones did.
export function usePlan(id: string, live: boolean) {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const detailRef = useRef<PlanDetail | null>(null);
  detailRef.current = detail;
  const [error, setError] = useState('');
  const since = useRef('');   // the latest device step this screen has heard about
  const prizeSince = useRef('');   // the latest prize count this screen has heard about
  const stamp = useRef('');
  const gen = useRef(0);   // counts the changes made on this screen: a read that was already on its way when one was made holds the old value, so it is read again instead of put on screen
  const quiet = useRef({ ticks: 0, idle: 0 });   // how long nothing changed: the check slows down while it stays quiet and is fast again as soon as anything moves

  const load = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const g = gen.current;
      const r = await call<PlanDetail>(`/api/logistics/plans/${id}`, 'GET');
      if (!r.ok) { setError(r.error); return false; }
      if (g !== gen.current) continue;   // something was changed on this screen while it was loading: read again once
      setDetail(r.data); setError('');
      stamp.current = r.data.plan.updated_at;
      since.current = r.data.done.reduce((m, d) => (d.done_at > m ? d.done_at : m), '');
      prizeSince.current = (r.data.prizes.done ?? []).reduce((m, d) => ((d.updated_at ?? '') > m ? d.updated_at ?? '' : m), r.data.plan.updated_at);
      quiet.current = { ticks: 0, idle: 0 };
      return true;
    }
    return true;
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const touched = () => { gen.current++; quiet.current = { ticks: 0, idle: 0 }; };

  // The check asks every 20 seconds while the screen is open and visible; after two quiet minutes it asks every 40 seconds and after four every minute, and goes back to 20 seconds when anything changes.
  const check = useCallback(async () => {
    const q = quiet.current;
    q.ticks++;
    if (q.ticks % (q.idle < 6 ? 1 : q.idle < 12 ? 2 : 3) !== 0) return;
    const params = new URLSearchParams();
    if (since.current) params.set('since', since.current);
    if (prizeSince.current) params.set('prize_since', prizeSince.current);
    const qs = params.toString();
    const r = await call<{ updated_at: string; status: string; count: number; changes: DoneRow[]; prize_changes: { line_id: string; step_id: string; done: number; updated_at: string }[] }>(`/api/logistics/plans/${id}/version${qs ? `?${qs}` : ''}`, 'GET');
    if (!r.ok) return;
    const cur = detailRef.current;
    if (!cur) return;
    const have = new Set(cur.done.map(doneKey));
    const fresh = r.data.changes.filter((c) => !have.has(doneKey(c)));
    const prize = r.data.prize_changes ?? [];
    if (r.data.changes.length) since.current = r.data.changes.reduce((m, d) => (d.done_at > m ? d.done_at : m), since.current);
    if (prize.length) prizeSince.current = prize.reduce((m, d) => (d.updated_at > m ? d.updated_at : m), prizeSince.current);
    quiet.current = fresh.length || prize.length ? { ticks: 0, idle: 0 } : { ticks: q.ticks, idle: q.idle + 1 };
    // Something else changed (devices, stations, a swap, a step undone elsewhere): read the whole plan again.
    if (r.data.updated_at !== stamp.current || r.data.count !== cur.done.length + fresh.length) void load();
    if (fresh.length || prize.length) {
      setDetail((c) => {
        if (!c) return c;
        const done = fresh.length ? [...c.done, ...fresh.filter((f) => !c.done.some((d) => doneKey(d) === doneKey(f)))] : c.done;
        let pd = c.prizes.done;
        if (prize.length) { const keys = new Set(prize.map((p) => `${p.line_id}:${p.step_id}`)); pd = [...pd.filter((d) => !keys.has(`${d.line_id}:${d.step_id}`)), ...prize.map((p) => ({ line_id: p.line_id, step_id: p.step_id, done: p.done, updated_at: p.updated_at }))]; }
        return { ...c, done, prizes: pd === c.prizes.done ? c.prizes : { ...c.prizes, done: pd } };
      });
    }
  }, [id, load]);
  useVisiblePoll(check, 20_000, live);

  const act = useCallback(async (url: string, method: string, body?: unknown): Promise<boolean> => {
    touched();
    const r = await call<unknown>(`/api/logistics/plans/${id}${url}`, method, body);
    if (!r.ok) { setError(r.error); return false; }
    setError('');
    await load();
    return true;
  }, [id, load]);

  // ---- steps (applied on screen)
  const doStep = useCallback(async (body: { tag?: string; device_id?: string; borrowed_id?: string; slot_id?: string; step_id: string; kit?: { item: string; missing: boolean }[] }): Promise<{ ok: true; result: StepResult } | { ok: false; error: string; network?: boolean }> => {
    const r = await call<StepResult>(`/api/logistics/plans/${id}/steps`, 'POST', body);
    if (!r.ok) return { ok: false, error: r.error, network: r.status === 0 };
    const res = r.data;
    touched();
    setDetail((cur) => {
      if (!cur) return cur;
      const club = res.item.kind === 'club';
      const row: DoneRow = club ? { device_id: res.item.id, step_id: res.step_id, done_at: res.done_at, by: res.by } : res.item.kind === 'slot' ? { slot_id: res.item.id, step_id: res.step_id, done_at: res.done_at, by: res.by } : { borrowed_id: res.item.id, step_id: res.step_id, done_at: res.done_at, by: res.by };
      const done = cur.done.some((d) => doneKey(d) === doneKey(row)) ? cur.done : [...cur.done, row];
      if (res.done_at > since.current) since.current = res.done_at;
      // The parts may have changed at Check done; a club device not in the plan is remembered as a spare used on the day.
      // The rows are only replaced when the parts really changed (Check done), so an ordinary tick leaves them as they are and nothing built from them is worked out again.
      const sameKit = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      const items = club && cur.items.some((i) => i.device_id === res.item.id && !sameKit(i.device.kit, res.item.kit)) ? cur.items.map((i) => (i.device_id === res.item.id ? { ...i, device: { ...i.device, kit: res.item.kit } } : i)) : cur.items;
      const borrowed = club || res.item.kind === 'slot' || !cur.borrowed.some((b) => b.id === res.item.id && !sameKit(b.kit, res.item.kit)) ? cur.borrowed : cur.borrowed.map((b) => (b.id === res.item.id ? { ...b, kit: res.item.kit } : b));
      const extras = res.item.kind !== 'club' || res.inPlan || cur.extras.some((e) => e.id === res.item.id) ? cur.extras : [...cur.extras, res.item as unknown as Device];
      return { ...cur, done, extras, items, borrowed };
    });
    return { ok: true, result: res };
  }, [id]);
  // The same step for many devices at once (Mark all): one request, and every box is shown ticked together.
  const doSteps = useCallback(async (step_id: string, items: { device_id?: string; borrowed_id?: string; slot_id?: string }[]): Promise<{ ok: true; added: number } | { ok: false; error: string }> => {
    const r = await call<{ rows: { device_id: string | null; borrowed_id: string | null; slot_id: string | null; step_id: string; done_at: string }[]; by: string | null }>(`/api/logistics/plans/${id}/steps`, 'POST', { step_id, items });
    if (!r.ok) return { ok: false, error: r.error };
    touched();
    const rows = r.data.rows.map((x): DoneRow => ({ ...(x.device_id ? { device_id: x.device_id } : x.borrowed_id ? { borrowed_id: x.borrowed_id } : { slot_id: x.slot_id }), step_id: x.step_id, done_at: x.done_at, by: r.data.by } as DoneRow));
    setDetail((cur) => {
      if (!cur || !rows.length) return cur;
      const have = new Set(cur.done.map(doneKey));
      return { ...cur, done: [...cur.done, ...rows.filter((x) => !have.has(doneKey(x)))] };
    });
    for (const x of rows) if (x.done_at > since.current) since.current = x.done_at;
    return { ok: true, added: rows.length };
  }, [id]);
  const undoStep = useCallback(async (item: { id: string; kind: 'club' | 'sponsor' | 'officer' | 'slot' }, step_id: string): Promise<'ok' | 'network' | 'failed'> => {
    const r = await call<{ ok: true }>(`/api/logistics/plans/${id}/steps`, 'DELETE', { ...(item.kind === 'club' ? { device_id: item.id } : item.kind === 'slot' ? { slot_id: item.id } : { borrowed_id: item.id }), step_id });
    if (!r.ok) { if (r.status !== 0) setError(r.error); return r.status === 0 ? 'network' : 'failed'; }
    touched();
    setDetail((cur) => (cur ? { ...cur, done: cur.done.filter((d) => doneKey(d) !== `${item.id}:${step_id}`) } : cur));
    return 'ok';
  }, [id]);
  const swap = useCallback(async (body: { device_id?: string; borrowed_id?: string; replacement_tag: string; reason: string }) => {
    const r = await call<{ replacement: Slim; station: { id: string; name: string } | null }>(`/api/logistics/plans/${id}/swap`, 'POST', body);
    if (!r.ok) return { ok: false as const, error: r.error };
    await load();
    return { ok: true as const, replacement: r.data.replacement, station: r.data.station };
  }, [id, load]);
  const unswap = useCallback(async (item: { id: string; kind: 'club' | 'sponsor' | 'officer' }): Promise<boolean> => {
    const r = await call<{ ok: true }>(`/api/logistics/plans/${id}/swap`, 'DELETE', item.kind === 'club' ? { device_id: item.id } : { borrowed_id: item.id });
    if (!r.ok) { setError(r.error); return false; }
    await load();
    return true;
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

  // A prize count ("sorted 6 of 10") is set as a number and shown at once; the server may lower it (it can't pass what the line has).
  const setPrizeCount = useCallback(async (line_id: string, step_id: string, done: number): Promise<boolean> => {
    let before: number | undefined;
    touched();
    setDetail((cur) => {
      if (!cur) return cur;
      before = cur.prizes.done.find((d) => d.line_id === line_id && d.step_id === step_id)?.done;
      const rest = cur.prizes.done.filter((d) => !(d.line_id === line_id && d.step_id === step_id));
      return { ...cur, prizes: { ...cur.prizes, done: [...rest, { line_id, step_id, done }] } };
    });
    const r = await call<{ done: number }>(`/api/logistics/plans/${id}/prize-steps`, 'POST', { line_id, step_id, done });
    const apply = (n: number) => setDetail((cur) => {
      if (!cur) return cur;
      const rest = cur.prizes.done.filter((d) => !(d.line_id === line_id && d.step_id === step_id));
      return { ...cur, prizes: { ...cur.prizes, done: [...rest, { line_id, step_id, done: n }] } };
    });
    if (!r.ok) { setError(r.error); apply(before ?? 0); return false; }
    if (r.data.done !== done) apply(r.data.done);
    return true;
  }, [id]);

  // The allocation grid sets how many of a prize a pool gets (0 takes it out). It shows at once; `delta` is how much more is now promised, so the stock's "left" can be moved by the same amount.
  const setPrizeLine = useCallback(async (pool_id: string, prize: PlanPrizesData['lines'][number]['prize'], quantity: number): Promise<{ ok: boolean; delta: number }> => {
    const cur = detailRef.current;
    if (!cur) return { ok: false, delta: 0 };
    const lines = cur.prizes.lines;
    const existing = lines.find((l) => l.pool_id === pool_id && l.prize_id === prize.id);
    const next = Math.max(0, Math.round(quantity));
    const before = existing?.quantity ?? 0;
    if (next === before) return { ok: true, delta: 0 };
    const delta = next - before;
    touched();
    if (delta > Math.max(0, prize.left)) { setError(`Only ${Math.max(0, prize.left)} left of ${prize.name}. A pool can't be promised more than there is.`); return { ok: false, delta: 0 }; }
    const withLines = (fn: (l: PlanPrizesData['lines']) => PlanPrizesData['lines']) => setDetail((c) => (c ? { ...c, prizes: { ...c.prizes, lines: fn(c.prizes.lines).map((l) => (l.prize_id === prize.id ? { ...l, prize: { ...l.prize, left: l.prize.left - delta } } : l)) } } : c));
    const undo = () => { void load(); };
    if (next === 0 && existing) {
      withLines((ls) => ls.filter((l) => l.id !== existing.id));
      const r = await call<{ ok: true }>(`/api/logistics/plans/${id}/prizes`, 'DELETE', { line_id: existing.id });
      if (!r.ok) { setError(r.error); undo(); return { ok: false, delta: 0 }; }
    } else if (existing) {
      withLines((ls) => ls.map((l) => (l.id === existing.id ? { ...l, quantity: next } : l)));
      const r = await call<{ line: { quantity: number } }>(`/api/logistics/plans/${id}/prizes`, 'PATCH', { line_id: existing.id, quantity: next });
      if (!r.ok) { setError(r.error); undo(); return { ok: false, delta: 0 }; }
    } else {
      const r = await call<{ lines: { id: string; pool_id: string; prize_id: string; quantity: number; sort: number }[] }>(`/api/logistics/plans/${id}/prizes`, 'POST', { pool_id, prize_id: prize.id, quantity: next });
      if (!r.ok) { setError(r.error); undo(); return { ok: false, delta: 0 }; }
      withLines((ls) => [...ls, { ...r.data.lines[0], prize }]);
    }
    setError('');
    return { ok: true, delta };
  }, [id, load]);

  return { detail, error, setError, reload: load, act, doStep, doSteps, undoStep, swap, unswap, pick, fill, assign, setPrizeCount, setPrizeLine };
}
export interface PickCell { type: string; games: string[]; counted: boolean; device: { id: string; tag: string | null; shelf: string | null; tier: string | null; condition: string } | null }
export interface PickPreview { stations: PickCell[][]; short: number | { type: string; missing: number }[]; notTested: number; missingGames: number; empty: number }
export type PlanApi = ReturnType<typeof usePlan>;
