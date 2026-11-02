import type { SupabaseClient } from '@supabase/supabase-js';
import { notEnough } from '@/lib/staffle/server';

export interface ItemInput {
  prize_id: string;
  winners: number;
  draw_order: number | null;
}

/** Makes a Staffle's items exactly `items` (prizes taken out lose their entries): checks a prize is only there once and that there is enough in stock to hold back. Returns a sentence when it can't be done. */
export async function applyItems(svc: SupabaseClient, staffleId: string, items: ItemInput[]): Promise<{ error: string; status: number } | null> {
  if (new Set(items.map((i) => i.prize_id)).size !== items.length) return { error: 'A prize can be in a Staffle only once. Give it more winners instead.', status: 400 };
  const short = items.length ? await notEnough(svc, items, staffleId) : null;
  if (short) return { error: short, status: 409 };
  const { data: have } = await svc.from('staffle_items').select('id, prize_id').eq('staffle_id', staffleId);
  const keep = new Map((have ?? []).map((h) => [h.prize_id as string, h.id as string]));
  const drop = (have ?? []).filter((h) => !items.some((i) => i.prize_id === h.prize_id)).map((h) => h.id as string);
  if (drop.length) await svc.from('staffle_items').delete().in('id', drop); // their entries go with them
  for (const [n, i] of items.entries()) {
    const kept = keep.get(i.prize_id);
    if (kept) await svc.from('staffle_items').update({ winners: i.winners, draw_order: i.draw_order, sort: n }).eq('id', kept);
    else await svc.from('staffle_items').insert({ staffle_id: staffleId, prize_id: i.prize_id, winners: i.winners, draw_order: i.draw_order, sort: n });
  }
  return null;
}
