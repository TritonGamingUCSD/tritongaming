import type { SupabaseClient } from '@supabase/supabase-js';
import { LIMITS, type OptionKind } from '@/lib/logistics/constants';

// What the routes for the editable lists share: cleaning what was sent, and finding what uses a list entry (so one in use is not deleted and a rename is followed).
export const APPLIES = ['all', 'club', 'borrowed'];
// A bundle's items: only device types that exist, each with a whole quantity.
export async function cleanItems(svc: SupabaseClient, raw: unknown): Promise<{ items?: { type: string; qty: number }[]; error?: string }> {
  if (!Array.isArray(raw)) return { error: 'A bundle needs at least one item.' };
  const { data: types } = await svc.from('logistics_options').select('value').eq('kind', 'type');
  const known = new Map((types ?? []).map((t) => [(t.value as string).toLowerCase(), t.value as string]));
  const items: { type: string; qty: number }[] = [];
  for (const x of raw.slice(0, 12)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const type = known.get(
      String(o.type ?? '')
        .trim()
        .toLowerCase(),
    );
    if (!type) return { error: `“${String(o.type ?? '')}” isn’t a device type.` };
    items.push({ type, qty: Math.min(20, Math.max(1, Math.round(Number(o.qty)) || 1)) });
  }
  return items.length ? { items } : { error: 'A bundle needs at least one item.' };
}
export const cleanValue = (v: unknown) =>
  String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, LIMITS.option);

// How many devices use a value (so a list entry that is in use can't be deleted, and a rename knows what to follow).
export async function devicesUsing(svc: SupabaseClient, kind: OptionKind, value: string): Promise<{ id: string }[]> {
  if (kind === 'step' || kind === 'bundle' || kind === 'prize_step') return []; // steps are checked against the steps already done, bundles are used by nothing
  if (kind === 'prize_size') {
    const { data } = await svc.from('logistics_prizes').select('id').eq('size', value);
    const { data: asked } = await svc.from('logistics_requests').select('id, items').eq('kind', 'prizes').limit(3000);
    return [...(data ?? []), ...(asked ?? []).filter((q) => ((q.items as { size?: string }[]) ?? []).some((i) => i.size === value))].map((x) => ({ id: x.id as string }));
  }
  const q = svc.from('logistics_devices').select('id, ports, games, kit');
  const { data } =
    kind === 'type'
      ? await q.eq('type', value)
      : kind === 'shelf'
        ? await q.eq('shelf', value)
        : kind === 'tier'
          ? await q.eq('tier', value)
          : kind === 'port'
            ? await q.contains('ports', [value])
            : kind === 'game'
              ? await q.contains('games', [value])
              : await q.contains('kit', [{ item: value }]);
  return (data ?? []) as { id: string }[];
}

// A prize size is kept as text on the prizes, on the lines of prize requests and on the stations made from them, so a rename is followed in all three.
export async function followPrizeSize(svc: SupabaseClient, old: string, now: string) {
  await svc.from('logistics_prizes').update({ size: now }).eq('size', old);
  const { data: asked } = await svc.from('logistics_requests').select('id, items').eq('kind', 'prizes').limit(3000);
  for (const q of asked ?? []) {
    const items = (q.items as { qty: number; size: string }[]) ?? [];
    if (items.some((i) => i.size === old))
      await svc
        .from('logistics_requests')
        .update({ items: items.map((i) => (i.size === old ? { ...i, size: now } : i)) })
        .eq('id', q.id as string);
  }
  const { data: pools } = await svc.from('logistics_stations').select('id, prize_target_sizes').not('prize_target_sizes', 'is', null).limit(3000);
  for (const p of pools ?? []) {
    const t = p.prize_target_sizes as Record<string, number>;
    if (old in t) {
      const { [old]: n, ...rest } = t;
      await svc
        .from('logistics_stations')
        .update({ prize_target_sizes: { ...rest, [now]: (rest[now] ?? 0) + n } })
        .eq('id', p.id as string);
    }
  }
}
