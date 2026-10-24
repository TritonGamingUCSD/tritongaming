import type { SupabaseClient } from '@supabase/supabase-js';
import { planPrizeUse, type PrizeStepDef, type PrizeTotals } from '@/lib/logistics/prizes';

// The columns of a prize as the screens use them.
export const PRIZE_COLUMNS = 'id, name, sponsor_id, size, type, in_hand, price, quantity, quantity_is_estimate, shelf, tier, place_note, plan_id, expires_on, notes';

// The prize steps, in order. `gives` and `leftover` live in the list entry's meta.
export async function loadPrizeSteps(svc: SupabaseClient): Promise<PrizeStepDef[]> {
  const { data } = await svc.from('logistics_options').select('id, value, sort, meta').eq('kind', 'prize_step').order('sort').order('value');
  return (data ?? []).map((o) => ({ id: o.id as string, name: o.value as string, sort: o.sort as number, gives: !!(o.meta as { gives?: boolean } | null)?.gives, leftover: !!(o.meta as { leftover?: boolean } | null)?.leftover }));
}

// For each prize: how many open plans still hold for their pools, and how many have been given out at any event. One read of the lines, one of the plans' status, one of the counts of the
// "gives" steps. With `only` it is limited to those prizes.
export async function loadPrizeTotals(svc: SupabaseClient, only?: string[]): Promise<Map<string, PrizeTotals>> {
  const totals = new Map<string, PrizeTotals>();
  let q = svc.from('logistics_plan_prizes').select('id, plan_id, prize_id, quantity').limit(30000);
  if (only) q = q.in('prize_id', only);
  const { data: lines } = await q;
  if (!lines?.length) return totals;
  const planIds = [...new Set(lines.map((l) => l.plan_id as string))];
  let kq = svc.from('logistics_plan_keeps').select('plan_id, prize_id, quantity').in('plan_id', planIds).not('moved_at', 'is', null);
  if (only) kq = kq.in('prize_id', only);
  const [{ data: plans }, steps, { data: keeps }] = await Promise.all([svc.from('logistics_plans').select('id, status, manual_return').in('id', planIds), loadPrizeSteps(svc), kq]);
  const plan = new Map((plans ?? []).map((p) => [p.id as string, { closed: p.status !== 'draft', manual: !!p.manual_return }]));
  const moved = new Map((keeps ?? []).map((k) => [`${k.plan_id}:${k.prize_id}`, k.quantity as number]));
  const giveIds = steps.filter((s) => s.gives).map((s) => s.id);
  const given = new Map<string, number>();
  if (giveIds.length) {
    const { data: done } = await svc.from('logistics_plan_prize_steps').select('line_id, done').in('step_id', giveIds).in('plan_id', planIds).limit(30000);
    for (const d of done ?? []) given.set(d.line_id as string, (given.get(d.line_id as string) ?? 0) + (d.done as number));
  }
  // Per event and prize: how many its lines hold and how many of those were given out.
  const per = new Map<string, { plan: string; prize: string; quantity: number; given: number }>();
  for (const l of lines) {
    const key = `${l.plan_id}:${l.prize_id}`;
    const e = per.get(key) ?? { plan: l.plan_id as string, prize: l.prize_id as string, quantity: 0, given: 0 };
    e.quantity += l.quantity as number;
    e.given += Math.min(given.get(l.id as string) ?? 0, l.quantity as number);
    per.set(key, e);
  }
  for (const [key, e] of per) {
    const p = plan.get(e.plan) ?? { closed: false, manual: false };
    const use = planPrizeUse({ quantity: e.quantity, given: e.given, moved: moved.get(key) ?? 0, closed: p.closed, manual: p.manual });
    const t = totals.get(e.prize) ?? { allocated: 0, given: 0 };
    t.allocated += use.allocated; t.given += use.given;
    totals.set(e.prize, t);
  }
  return totals;
}

// What an event's lines hold of each prize and how many of those were given out (for the Keep list's limits).
export async function planPrizeCounts(svc: SupabaseClient, planId: string): Promise<Map<string, { quantity: number; given: number }>> {
  const [{ data: lines }, steps] = await Promise.all([svc.from('logistics_plan_prizes').select('id, prize_id, quantity').eq('plan_id', planId).limit(5000), loadPrizeSteps(svc)]);
  const giveIds = steps.filter((s) => s.gives).map((s) => s.id);
  const given = new Map<string, number>();
  if (giveIds.length && lines?.length) {
    const { data: done } = await svc.from('logistics_plan_prize_steps').select('line_id, done').eq('plan_id', planId).in('step_id', giveIds).limit(30000);
    for (const d of done ?? []) given.set(d.line_id as string, (given.get(d.line_id as string) ?? 0) + (d.done as number));
  }
  const out = new Map<string, { quantity: number; given: number }>();
  for (const l of lines ?? []) {
    const e = out.get(l.prize_id as string) ?? { quantity: 0, given: 0 };
    e.quantity += l.quantity as number;
    e.given += Math.min(given.get(l.id as string) ?? 0, l.quantity as number);
    out.set(l.prize_id as string, e);
  }
  return out;
}

export interface PlanPrizes {
  pools: { id: string; name: string; station_id: string | null; sort: number; request_id: string | null; target_qty: number | null; target_sizes: Record<string, number> | null }[];
  lines: { id: string; pool_id: string; prize_id: string; quantity: number; sort: number; prize: { id: string; name: string; sponsor: string | null; size: string | null; type: string | null; in_hand: boolean; price: number | null; quantity: number; quantity_is_estimate: boolean; left: number } }[];
  done: { line_id: string; step_id: string; done: number; updated_at?: string }[];
  steps: PrizeStepDef[];
  keeps: { prize_id: string; quantity: number; moved_at: string | null }[];   // prizes set aside to keep for future events
}

// Everything the plan screen needs about prizes, in four small reads plus the totals of the prizes used: pools, their lines (each with the prize's name, sponsor, size, price and how many are
// left), the step counts, and the step list.
export async function loadPlanPrizes(svc: SupabaseClient, planId: string): Promise<PlanPrizes> {
  const [pools, lines, done, steps, keeps] = await Promise.all([
    svc.from('logistics_plan_pools').select('id, name, station_id, sort, request_id, target_qty, target_sizes').eq('plan_id', planId).order('sort').limit(200),
    svc.from('logistics_plan_prizes').select('id, pool_id, prize_id, quantity, sort').eq('plan_id', planId).order('sort').limit(3000),
    svc.from('logistics_plan_prize_steps').select('line_id, step_id, done, updated_at').eq('plan_id', planId).limit(30000),
    loadPrizeSteps(svc),
    svc.from('logistics_plan_keeps').select('prize_id, quantity, moved_at').eq('plan_id', planId),
  ]);
  const ids = [...new Set((lines.data ?? []).map((l) => l.prize_id as string))];
  const [prizes, totals] = ids.length ? await Promise.all([svc.from('logistics_prizes').select(PRIZE_COLUMNS).in('id', ids), loadPrizeTotals(svc, ids)]) : [{ data: [] as Record<string, unknown>[] }, new Map<string, PrizeTotals>()];
  const sponsorIds = [...new Set((prizes.data ?? []).map((p) => p.sponsor_id as string | null).filter((x): x is string => !!x))];
  const { data: sponsors } = sponsorIds.length ? await svc.from('logistics_sponsors').select('id, name').in('id', sponsorIds) : { data: [] };
  const sponsorName = new Map((sponsors ?? []).map((s) => [s.id as string, s.name as string]));
  const byId = new Map((prizes.data ?? []).map((p) => [p.id as string, p]));
  return {
    pools: (pools.data ?? []) as PlanPrizes['pools'],
    lines: (lines.data ?? []).flatMap((l) => {
      const p = byId.get(l.prize_id as string);
      if (!p) return [];
      const t = totals.get(p.id as string) ?? { allocated: 0, given: 0 };
      return [{ id: l.id as string, pool_id: l.pool_id as string, prize_id: l.prize_id as string, quantity: l.quantity as number, sort: l.sort as number,
        prize: { id: p.id as string, name: p.name as string, sponsor: p.sponsor_id ? sponsorName.get(p.sponsor_id as string) ?? null : null, size: (p.size as string | null) ?? null, type: (p.type as string | null) ?? null, in_hand: p.in_hand !== false, price: p.price === null ? null : Number(p.price), quantity: p.quantity as number, quantity_is_estimate: !!p.quantity_is_estimate, left: (p.quantity as number) - t.given - t.allocated } }];
    }),
    done: (done.data ?? []) as PlanPrizes['done'],
    steps,
    keeps: (keeps.data ?? []) as PlanPrizes['keeps'],
  };
}
