import type { SupabaseClient } from '@supabase/supabase-js';
import { activeCount } from '@/lib/members/strikes';
import { ensureLoose, loadPrizeTotals } from '@/lib/logistics/prizeServer';
import { prizeLeft } from '@/lib/logistics/prizes';
import { slugify } from '@/lib/core/slug';
import { createNotifications } from '@/lib/notifications/notify';
import type { Person } from '@/lib/staffle/rules';

// What the Staffle routes share: the states a Staffle goes through, a person's roles and marks for the rules, a slug for the address, and what a Staffle holds back from stock.

export const STAFFLE_COLUMNS = 'id, slug, name, notes, pickup_note, rules, status, seed, drawn_at, created_by, created_at';
// A Staffle is opened and closed by hand: draft (not open yet), open (taking entries), closed (no more entries, can open again), drawn or ended (one that is not wanted is removed).
export type StaffleState = 'draft' | 'open' | 'closed' | 'drawn' | 'ended';
// Before it is drawn the prizes can still change and it can still be drawn.
export const BEFORE_DRAW: string[] = ['draft', 'open', 'closed'];

export async function personFacts(svc: SupabaseClient, userId: string): Promise<Person> {
  const [{ data: roles }, marks] = await Promise.all([svc.from('user_roles').select('role').eq('user_id', userId), activeCount(svc, userId)]);
  return { id: userId, roles: (roles ?? []).map((r) => r.role as string), marks };
}

// A name for the address: made from the Staffle's name, with a number added if another Staffle already has it.
export async function freshSlug(svc: SupabaseClient, name: string): Promise<string> {
  const base = slugify(name).slice(0, 50) || 'staffle';
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    const { data } = await svc.from('staffles').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export const UUID = /^[0-9a-f-]{36}$/i;

// A Staffle may not hold back more of a prize than is left to promise (stock, minus what events and other Staffles already hold). `exceptStaffle` leaves one Staffle's own holds out (when it is being edited).
export async function notEnough(svc: SupabaseClient, items: { prize_id: string; winners: number }[], exceptStaffle?: string): Promise<string | null> {
  await ensureLoose(svc);
  const ids = items.map((i) => i.prize_id);
  const [{ data: prizes }, totals] = await Promise.all([svc.from('logistics_prizes').select('id, name, quantity, size, stock_level').in('id', ids), loadPrizeTotals(svc, ids)]);
  let own = new Map<string, number>();
  if (exceptStaffle) {
    const { data } = await svc.from('staffle_items').select('prize_id, winners').eq('staffle_id', exceptStaffle);
    own = new Map((data ?? []).map((i) => [i.prize_id as string, i.winners as number]));
  }
  if (prizes?.length !== new Set(ids).size) return 'One of those prizes is gone.';
  for (const p of prizes) {
    const t = totals.get(p.id as string) ?? { allocated: 0 };
    const left = prizeLeft(p as { quantity: number; size: string | null; stock_level: string }, { allocated: Math.max(0, t.allocated - (own.get(p.id as string) ?? 0)) });
    const want = items.find((i) => i.prize_id === p.id)!.winners;
    if (want > left) return `Only ${Math.max(0, left)} left of ${p.name} to raffle. That is not enough for ${want} winners.`;
  }
  return null;
}

// "You won <item> in <Staffle>!", with the Staffle's pickup note.
export async function tellWinners(svc: SupabaseClient, row: Record<string, unknown>, winners: { user_id: string; item_id: string }[], items: { id: string; prize_id: string }[]) {
  if (!winners.length) return;
  const { data: prizes } = await svc
    .from('logistics_prizes')
    .select('id, name')
    .in('id', [...new Set(items.map((i) => i.prize_id))]);
  const name = new Map((prizes ?? []).map((p) => [p.id as string, p.name as string]));
  const prizeOf = new Map(items.map((i) => [i.id, name.get(i.prize_id) ?? 'a prize']));
  await createNotifications(
    svc,
    winners.map((w) => ({
      user_id: w.user_id,
      type: 'logistics_staffle',
      title: `You won ${prizeOf.get(w.item_id)} in ${row.name}!`,
      body: row.pickup_note as string,
      href: `/portal/staffle/${row.slug}`,
    })),
  );
}
