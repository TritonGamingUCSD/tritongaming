import type { SupabaseClient } from '@supabase/supabase-js';
import { isLoose, lineNumbers, setLooseSizes, type PrizeStepDef, type PrizeTotals } from '@/lib/logistics/prizes';
import { announce, stockTopic } from '@/lib/logistics/live';
import { loadStaffleHolds } from '@/lib/staffle/holds';

// The columns of a prize as the screens use them.
export const PRIZE_COLUMNS = 'id, name, sponsor_id, size, type, in_hand, price, quantity, quantity_is_estimate, stock_level, photo, bin, source, from_event, from_plan_id, expires_on, notes';

// Reads which sizes are counted loosely (the switch on a size in the list) so `isLoose` knows. Kept for a few seconds; a change to a size forgets it (see forgetLoose).
let looseAt = 0;
export const forgetLoose = () => { looseAt = 0; };
export async function ensureLoose(svc: SupabaseClient): Promise<void> {
  if (Date.now() - looseAt < 5000) return;
  const { data } = await svc.from('logistics_options').select('value, meta').eq('kind', 'prize_size');
  setLooseSizes((data ?? []).filter((o) => (o.meta as { loose?: boolean } | null)?.loose).map((o) => o.value as string));
  looseAt = Date.now();
}

// The prize steps, in order. `gives` and `leftover` live in the list entry's meta.
export async function loadPrizeSteps(svc: SupabaseClient): Promise<PrizeStepDef[]> {
  const { data } = await svc.from('logistics_options').select('id, value, sort, meta').eq('kind', 'prize_step').order('sort').order('value');
  return (data ?? []).map((o) => ({ id: o.id as string, name: o.value as string, sort: o.sort as number, gives: !!(o.meta as { gives?: boolean } | null)?.gives, leftover: !!(o.meta as { leftover?: boolean } | null)?.leftover }));
}

// What was counted at the steps of one kind ("given out" or "back to storage") for a line.
export const countAt = (done: { line_id: unknown; step_id: unknown; done: unknown }[] | null, lineId: string, stepIds: Set<string>) =>
  (done ?? []).filter((d) => d.line_id === lineId && stepIds.has(d.step_id as string)).reduce((n, d) => n + (d.done as number), 0);
export const stepKinds = (steps: PrizeStepDef[]) => ({ gives: new Set(steps.filter((s) => s.gives).map((s) => s.id)), back: new Set(steps.filter((s) => s.leftover).map((s) => s.id)) });

// For each prize: how many the open events still hold for their stations (each line's `held`: promised, minus given out, minus back in storage). A closed event holds nothing. One read of the open events,
// one of their lines and one of the counts of the "given out" and "back to storage" steps. With `only` it is limited to those prizes.
export async function loadPrizeTotals(svc: SupabaseClient, only?: string[]): Promise<Map<string, PrizeTotals>> {
  const totals = new Map<string, PrizeTotals>();
  // A Staffle holds back the prizes it is raffling (until they are claimed or it ends).
  for (const [id, n] of await loadStaffleHolds(svc, only)) totals.set(id, { allocated: n });
  const { data: open } = await svc.from('logistics_plans').select('id').eq('status', 'draft').limit(500);
  const planIds = (open ?? []).map((p) => p.id as string);
  if (!planIds.length) return totals;
  let q = svc.from('logistics_plan_prizes').select('id, prize_id, quantity').in('plan_id', planIds).limit(30000);
  if (only) q = q.in('prize_id', only);
  const [{ data: lines }, steps] = await Promise.all([q, loadPrizeSteps(svc)]);
  if (!lines?.length) return totals;
  const { gives, back } = stepKinds(steps);
  const countedIds = [...gives, ...back];
  const { data: done } = countedIds.length ? await svc.from('logistics_plan_prize_steps').select('line_id, step_id, done').in('step_id', countedIds).in('plan_id', planIds).limit(30000) : { data: [] as { line_id: string; step_id: string; done: number }[] };
  for (const l of lines) {
    const id = l.id as string;
    const t = totals.get(l.prize_id as string) ?? { allocated: 0 };
    t.allocated += lineNumbers(l.quantity as number, countAt(done, id, gives), countAt(done, id, back)).held;
    totals.set(l.prize_id as string, t);
  }
  return totals;
}

// ---- the stock history ----------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface PrizeLogEntry {
  prize_id: string; kind: 'add' | 'correct' | 'assign' | 'give'; qty: number; plan_id?: string | null; plan_name?: string | null; station?: string | null; sponsor_id?: string | null;
  note?: string | null; ref?: string | null; actor: string | null;
}
export async function logPrize(svc: SupabaseClient, entries: PrizeLogEntry[]) {
  if (entries.length) await svc.from('logistics_prize_log').insert(entries.map((e) => ({ plan_id: null, plan_name: null, station: null, sponsor_id: null, note: null, ref: null, ...e })));
}

// Changes how many of a prize are on hand by `delta` (never below 0), says what the count is now, and tells everyone with the page open.
export async function bumpStock(svc: SupabaseClient, prizeId: string, delta: number, who?: { id: string | null; name: string | null }): Promise<number | null> {
  await ensureLoose(svc);
  const { data } = await svc.from('logistics_prizes').select('quantity, size').eq('id', prizeId).maybeSingle();
  if (!data) return null;
  if (isLoose(data as { size: string | null })) return data.quantity as number;   // loose prizes have no exact stock to change
  const next = Math.max(0, (data.quantity as number) + delta);
  await svc.from('logistics_prizes').update({ quantity: next, updated_at: new Date().toISOString(), ...(who?.id ? { updated_by: who.id } : {}) }).eq('id', prizeId);
  await announce(stockTopic(), { k: 'stock', prize: prizeId, qty: next, was: data.quantity as number }, who);
  return next;
}

export interface PlanPrizes {
  lines: { id: string; station_id: string; prize_id: string; quantity: number; sort: number; prize: { id: string; name: string; sponsor: string | null; size: string | null; type: string | null; in_hand: boolean; price: number | null; quantity: number; quantity_is_estimate: boolean; left: number } }[];
  done: { line_id: string; step_id: string; done: number; updated_at?: string }[];
  steps: PrizeStepDef[];
}

// Everything the plan screen needs about prizes, in four small reads plus the totals of the prizes used: pools, their lines (each with the prize's name, sponsor, size, price and how many are
// left), the step counts, and the step list.
export async function loadPlanPrizes(svc: SupabaseClient, planId: string): Promise<PlanPrizes> {
  const [lines, done, steps] = await Promise.all([
    svc.from('logistics_plan_prizes').select('id, station_id, prize_id, quantity, sort').eq('plan_id', planId).order('sort').limit(3000),
    svc.from('logistics_plan_prize_steps').select('line_id, step_id, done, updated_at').eq('plan_id', planId).limit(30000),
    loadPrizeSteps(svc),
  ]);
  const ids = [...new Set((lines.data ?? []).map((l) => l.prize_id as string))];
  const [prizes, totals] = ids.length ? await Promise.all([svc.from('logistics_prizes').select(PRIZE_COLUMNS).in('id', ids), loadPrizeTotals(svc, ids)]) : [{ data: [] as Record<string, unknown>[] }, new Map<string, PrizeTotals>()];
  const sponsorIds = [...new Set((prizes.data ?? []).map((p) => p.sponsor_id as string | null).filter((x): x is string => !!x))];
  const { data: sponsors } = sponsorIds.length ? await svc.from('logistics_sponsors').select('id, name').in('id', sponsorIds) : { data: [] };
  const sponsorName = new Map((sponsors ?? []).map((s) => [s.id as string, s.name as string]));
  const byId = new Map((prizes.data ?? []).map((p) => [p.id as string, p]));
  return {
    lines: (lines.data ?? []).flatMap((l) => {
      const p = byId.get(l.prize_id as string);
      if (!p) return [];
      const t = totals.get(p.id as string) ?? { allocated: 0 };
      return [{ id: l.id as string, station_id: l.station_id as string, prize_id: l.prize_id as string, quantity: l.quantity as number, sort: l.sort as number,
        prize: { id: p.id as string, name: p.name as string, sponsor: p.sponsor_id ? sponsorName.get(p.sponsor_id as string) ?? null : null, size: (p.size as string | null) ?? null, type: (p.type as string | null) ?? null, in_hand: p.in_hand !== false, price: p.price === null ? null : Number(p.price), quantity: p.quantity as number, quantity_is_estimate: !!p.quantity_is_estimate, left: (p.quantity as number) - t.allocated } }];
    }),
    done: (done.data ?? []) as PlanPrizes['done'],
    steps,
  };
}
