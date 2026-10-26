import type { SupabaseClient } from '@supabase/supabase-js';

// For each prize: how many a Staffle is holding back from stock. An open Staffle holds the winners it asks for; a drawn one holds the winners picked that are not yet claimed; ended and cancelled ones hold nothing
// (a prize that was claimed has already left stock). With `only` it is limited to those prizes.
export async function loadStaffleHolds(svc: SupabaseClient, only?: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const { data: live } = await svc.from('staffles').select('id, status').in('status', ['open', 'drawn']).limit(500);
  if (!live?.length) return out;
  const status = new Map(live.map((s) => [s.id as string, s.status as string]));
  let q = svc.from('staffle_items').select('id, staffle_id, prize_id, winners').in('staffle_id', [...status.keys()]).limit(5000);
  if (only) q = q.in('prize_id', only);
  const { data: items } = await q;
  if (!items?.length) return out;
  const { data: won } = await svc.from('staffle_winners').select('item_id, claimed_at, passed_at').in('item_id', items.map((i) => i.id as string)).limit(20000);
  const left = new Map<string, number>();
  for (const w of won ?? []) if (!w.claimed_at && !w.passed_at) left.set(w.item_id as string, (left.get(w.item_id as string) ?? 0) + 1);
  for (const i of items) {
    const n = status.get(i.staffle_id as string) === 'open' ? (i.winners as number) : left.get(i.id as string) ?? 0;
    if (n > 0) out.set(i.prize_id as string, (out.get(i.prize_id as string) ?? 0) + n);
  }
  return out;
}
