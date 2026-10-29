import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureLoose, loadPrizeTotals } from '@/lib/logistics/prizeServer';
import { whoIs } from '@/lib/logistics/live';
import { prizeLeft } from '@/lib/logistics/prizes';

// What the routes for a station's prizes share: the names the history uses, who last changed a number, and the check that nothing is promised that is not there.
export const planNameOf = async (svc: SupabaseClient, id: string) =>
  ((await svc.from('logistics_plans').select('name').eq('id', id).maybeSingle()).data?.name as string | undefined) ?? null;
export const stationNameOf = async (svc: SupabaseClient, id: string) =>
  ((await svc.from('logistics_stations').select('name').eq('id', id).maybeSingle()).data?.name as string | undefined) ?? null;
export async function changedBy(svc: SupabaseClient, userId: string | null | undefined): Promise<string> {
  return userId ? (await whoIs(svc, userId)).name : 'Someone';
}

// Never promise more than there is: each prize's `add` (how many more a station is asking for) can't be above what is left of it (on hand, minus what open events hold).
// Lowering a station's number is always allowed, so a prize that ended up over-promised (its stock was changed afterwards) can be fixed by lowering a station.
export async function noRoom(svc: SupabaseClient, wants: { prize_id: string; add: number }[]): Promise<string | null> {
  const need = new Map<string, number>();
  for (const w of wants) need.set(w.prize_id, (need.get(w.prize_id) ?? 0) + w.add);
  const ids = [...need].filter(([, n]) => n > 0).map(([id]) => id);
  if (!ids.length) return null;
  await ensureLoose(svc);
  const [{ data: prizes }, totals] = await Promise.all([svc.from('logistics_prizes').select('id, name, quantity, size, stock_level').in('id', ids), loadPrizeTotals(svc, ids)]);
  for (const p of prizes ?? []) {
    const left = prizeLeft(p as { quantity: number; size: string | null; stock_level: string }, totals.get(p.id as string) ?? { allocated: 0 });
    if ((need.get(p.id as string) ?? 0) > left) return `Only ${Math.max(0, left)} left of ${p.name}. That is not enough for ${need.get(p.id as string)} more.`;
  }
  return null;
}
