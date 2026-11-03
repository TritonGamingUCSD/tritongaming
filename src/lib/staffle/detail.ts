import { ranksFor } from '@/lib/staffle/draw';
import type { SupabaseClient } from '@supabase/supabase-js';
import { namesOf } from '@/lib/docs/docsServer';
import { canEnter, cleanRules, type Rules } from '@/lib/staffle/rules';
import { personFacts, STAFFLE_COLUMNS, type StaffleState } from '@/lib/staffle/server';

// One Staffle as the page shows it: its items with the prize, how many entered, whether you did, and (once drawn) who won and who has claimed.
export interface StaffleItemView {
  id: string;
  prize_id: string;
  winners: number;
  /** The number the host gave for when it is drawn (lower first), or null for by value. */
  draw_order: number | null;
  entries: number;
  mine: boolean;
  entrants: string[]; // entrants: their names, only for the people who run it (the draw screen shuffles them)
  prize: { name: string; photo: string; sponsor: string | null; type: string | null; size: string | null };
  won: { id: string; user_id: string; name: string; position: number; claimed: boolean; via: 'entered' | 'leftover' }[];
}
export interface StaffleView {
  id: string;
  slug: string;
  name: string;
  notes: string | null;
  pickup_note: string;
  state: StaffleState;
  drawn_at: string | null;
  rules: Rules;
  rule_names: Record<string, string>;
  items: StaffleItemView[];
  me: { can_enter: boolean; why: string | null; entered: number; anything: boolean; won: { item_id: string; prize: string; claimed: boolean }[] };
  entrants: number;
  /** How many people said they would take anything left. */
  anything: number;
  canManage: boolean;
}

export async function loadStaffle(svc: SupabaseClient, slugOrId: string): Promise<Record<string, unknown> | null> {
  const col = /^[0-9a-f-]{36}$/i.test(slugOrId) ? 'id' : 'slug';
  const { data } = await svc.from('staffles').select(STAFFLE_COLUMNS).eq(col, slugOrId).maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function staffleView(svc: SupabaseClient, row: Record<string, unknown>, userId: string, canManage: boolean): Promise<StaffleView> {
  const id = row.id as string;
  const rules = cleanRules(row.rules);
  const [{ data: items }, { data: entries }, { data: won }, { data: anyone }, person] = await Promise.all([
    svc.from('staffle_items').select('id, prize_id, winners, draw_order, sort').eq('staffle_id', id).order('sort').limit(500),
    svc.from('staffle_entries').select('item_id, user_id').eq('staffle_id', id).limit(30000),
    svc.from('staffle_winners').select('id, item_id, user_id, position, claimed_at, via').eq('staffle_id', id).order('position').limit(5000),
    svc.from('staffle_anything').select('user_id').eq('staffle_id', id).limit(5000),
    personFacts(svc, userId),
  ]);
  const prizeIds = [...new Set((items ?? []).map((i) => i.prize_id as string))];
  const [{ data: prizes }, { data: sponsors }] = await Promise.all([
    prizeIds.length
      ? svc.from('logistics_prizes').select('id, name, photo, sponsor_id, type, size, price').in('id', prizeIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    svc.from('logistics_sponsors').select('id, name'),
  ]);
  const sponsor = new Map((sponsors ?? []).map((s) => [s.id as string, s.name as string]));
  const prize = new Map((prizes ?? []).map((p) => [p.id as string, p]));
  const names = await namesOf(svc, [
    ...(won ?? []).map((w) => w.user_id as string),
    ...rules.people,
    ...rules.block,
    ...(canManage ? (entries ?? []).map((e) => e.user_id as string) : []),
  ]);
  const perItem = new Map<string, number>(),
    mine = new Set<string>();
  for (const e of entries ?? []) {
    perItem.set(e.item_id as string, (perItem.get(e.item_id as string) ?? 0) + 1);
    if (e.user_id === userId) mine.add(e.item_id as string);
  }
  const state = row.status as StaffleState;
  // Shown in the order they are drawn: the Draw # the host set, then by value (the same ranking the draw uses); prizes that tie keep the order they were added in.
  const ranks = ranksFor(
    (items ?? []).map((i) => ({
      id: i.id as string,
      draw_order: (i.draw_order as number | null) ?? null,
      price: Number((prize.get(i.prize_id as string) as { price?: number } | undefined)?.price ?? 0),
    })),
  );
  const inDrawOrder = [...(items ?? [])].sort((a, b) => (ranks.get(a.id as string) ?? 0) - (ranks.get(b.id as string) ?? 0));
  const itemViews: StaffleItemView[] = inDrawOrder.map((i) => {
    const p = prize.get(i.prize_id as string) as { name: string; photo: string; sponsor_id: string | null; type: string | null; size: string | null } | undefined;
    return {
      id: i.id as string,
      prize_id: i.prize_id as string,
      winners: i.winners as number,
      draw_order: (i.draw_order as number | null) ?? null,
      entries: perItem.get(i.id as string) ?? 0,
      mine: mine.has(i.id as string),
      entrants: canManage ? (entries ?? []).filter((e) => e.item_id === i.id).map((e) => names.get(e.user_id as string) ?? 'Someone') : [],
      prize: {
        name: p?.name ?? 'A prize',
        photo: p?.photo ?? '',
        sponsor: p?.sponsor_id ? (sponsor.get(p.sponsor_id) ?? null) : null,
        type: p?.type ?? null,
        size: p?.size ?? null,
      },
      won: (won ?? [])
        .filter((w) => w.item_id === i.id)
        .map((w) => ({
          id: w.id as string,
          user_id: w.user_id as string,
          name: names.get(w.user_id as string) ?? 'Someone',
          position: w.position as number,
          claimed: !!w.claimed_at,
          via: (w.via as 'entered' | 'leftover') ?? 'entered',
        })),
    };
  });
  const verdict = canEnter(rules, person);
  return {
    id,
    slug: row.slug as string,
    name: row.name as string,
    notes: (row.notes as string | null) ?? null,
    pickup_note: row.pickup_note as string,
    state,
    drawn_at: (row.drawn_at as string | null) ?? null,
    rules,
    rule_names: Object.fromEntries([...rules.people, ...rules.block].map((u) => [u, names.get(u) ?? 'Someone'])),
    items: itemViews,
    me: {
      can_enter: verdict.ok,
      why: verdict.ok ? null : verdict.why,
      entered: mine.size,
      anything: (anyone ?? []).some((a) => a.user_id === userId),
      won: itemViews.flatMap((i) => i.won.filter((w) => w.user_id === userId).map((w) => ({ item_id: i.id, prize: i.prize.name, claimed: w.claimed }))),
    },
    entrants: new Set((entries ?? []).map((e) => e.user_id as string)).size,
    anything: (anyone ?? []).length,
    canManage,
  };
}
