import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeviceItem } from './requests';

// What a device request turns into in the allocation: one empty row per unit. A bundle line makes a set per unit (a row for every item of the bundle, quantity 2 = two rows).
export interface Want { type: string; games: string[]; set: number | null }
export function wantedRows(items: DeviceItem[], bundles: Map<string, { type: string; qty: number }[]>): Want[] {
  const out: Want[] = [];
  let set = 0;
  for (const it of items) {
    const parts = bundles.get(it.what.toLowerCase());
    for (let u = 0; u < it.qty; u++) {
      if (!parts) { out.push({ type: it.what, games: it.games, set: null }); continue; }
      set += 1;
      parts.forEach((p, i) => { for (let k = 0; k < Math.max(1, p.qty); k++) out.push({ type: p.type, games: i === 0 ? it.games : [], set }); });
    }
  }
  return out;
}

// How many rows of each type to add (positive) or take away (negative), comparing what the request wants with what its rows already are.
export function rowDiff(want: Want[], have: Map<string, number>): Map<string, number> {
  const need = new Map<string, number>();
  for (const w of want) need.set(w.type.toLowerCase(), (need.get(w.type.toLowerCase()) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const k of new Set([...need.keys(), ...have.keys()])) { const d = (need.get(k) ?? 0) - (have.get(k) ?? 0); if (d) out.set(k, d); }
  return out;
}

interface Req { id: string; plan_id: string; kind: string; team: string | null; division_id: string | null; items: unknown; status: string }
interface RowRef { id: string; sort: number; set_id: string | null; key: string; slot: boolean; locked: boolean }

// Make the plan's rows match one device request, line by line. A bundle line is whole sets (a row for every item of the bundle, one set per unit); a type line is plain rows. More
// units add empty rows; fewer take away the extras, empty ones first and then ones with a device (it goes back to storage), except a device with an event-day step done (the count that
// stays is returned). A declined request keeps no rows. The team is found by name (the request's team, else its division) or made.
export async function syncRequestRows(svc: SupabaseClient, r: Req): Promise<{ kept: number }> {
  if (r.kind !== 'devices') return { kept: 0 };
  const [{ data: slots }, { data: devs }, { data: opts }] = await Promise.all([
    svc.from('logistics_plan_slots').select('id, type, sort, set_id, request_item').eq('request_id', r.id),
    svc.from('logistics_plan_devices').select('device_id, sort, set_id, request_item').eq('request_id', r.id),
    svc.from('logistics_options').select('value, meta').eq('kind', 'bundle'),
  ]);
  const ids = (devs ?? []).map((d) => d.device_id as string);
  const { data: dd } = ids.length ? await svc.from('logistics_devices').select('id, type').in('id', ids) : { data: [] };
  // A device that already has an event-day step done is part of the record, so it is never taken out.
  const { data: ticks } = ids.length ? await svc.from('logistics_plan_steps').select('device_id').eq('plan_id', r.plan_id).in('device_id', ids) : { data: [] };
  const started = new Set((ticks ?? []).map((x) => x.device_id as string));
  const typeOf = new Map((dd ?? []).map((d) => [d.id as string, d.type as string]));
  const bundles = new Map((opts ?? []).map((o) => [String(o.value).toLowerCase(), ((o.meta as { items?: { type: string; qty: number }[] } | null)?.items ?? [])]));
  const items: DeviceItem[] = r.status === 'declined' ? [] : ((r.items as DeviceItem[]) ?? []);
  const refs: RowRef[] = [
    ...(slots ?? []).map((x) => ({ id: x.id as string, sort: x.sort as number, set_id: x.set_id as string | null, key: String(x.request_item ?? x.type).toLowerCase(), slot: true, locked: false })),
    ...(devs ?? []).map((x) => ({ id: x.device_id as string, sort: x.sort as number, set_id: x.set_id as string | null, key: String(x.request_item ?? typeOf.get(x.device_id as string) ?? '').toLowerCase(), slot: false, locked: started.has(x.device_id as string) })),
  ];
  const wanted = new Set(items.map((i) => i.what.toLowerCase()));
  const drop: string[] = [];
  const dropDev: string[] = [];
  // Take away what is no longer asked for: empty rows first, then ones with a device (which goes back to storage), the last-added first.
  const cutOf = (groups: RowRef[][], n: number) => groups.filter((g) => !g.some((x) => x.locked)).sort((a, b) => Number(a.every((x) => x.slot)) === Number(b.every((x) => x.slot)) ? Math.max(...b.map((x) => x.sort)) - Math.max(...a.map((x) => x.sort)) : Number(b.every((x) => x.slot)) - Number(a.every((x) => x.slot))).slice(0, n);
  let kept = 0;
  const add: { item: DeviceItem; units: number }[] = [];

  for (const key of new Set([...wanted, ...refs.map((x) => x.key)])) {
    const item = items.find((i) => i.what.toLowerCase() === key);
    const mine = refs.filter((x) => x.key === key);
    const parts = bundles.get(key);
    const need = item?.qty ?? 0;
    if (parts && mine.some((x) => x.set_id)) {
      const sets = new Map<string, RowRef[]>();
      for (const x of mine) if (x.set_id) sets.set(x.set_id, [...(sets.get(x.set_id) ?? []), x]);
      const have = sets.size;
      if (have < need && item) add.push({ item, units: need - have });
      if (have > need) {
        const cut = cutOf([...sets.values()], have - need);
        for (const g of cut) for (const x of g) (x.slot ? drop : dropDev).push(x.id);
        kept += have - need - cut.length;
      }
    } else {
      const have = mine.length;
      if (have < need && item) add.push({ item, units: need - have });
      if (have > need) {
        const cut = cutOf(mine.map((x) => [x]), have - need).map((g) => g[0]);
        for (const x of cut) (x.slot ? drop : dropDev).push(x.id);
        kept += have - need - cut.length;
      }
    }
  }
  if (drop.length) await svc.from('logistics_plan_slots').delete().in('id', drop);
  if (dropDev.length) await svc.from('logistics_plan_devices').delete().eq('plan_id', r.plan_id).in('device_id', dropDev);
  if (!add.length) return { kept };

  let name = r.team?.trim() || null;
  if (!name && r.division_id) name = ((await svc.from('divisions').select('name').eq('id', r.division_id).maybeSingle()).data?.name as string | undefined) ?? null;
  let station: string | null = null;
  if (name) {
    const { data: sts } = await svc.from('logistics_stations').select('id, name, sort').eq('plan_id', r.plan_id);
    const hit = (sts ?? []).find((s) => (s.name as string).toLowerCase() === name!.toLowerCase());
    if (hit) station = hit.id as string;
    else {
      const made = await svc.from('logistics_stations').insert({ plan_id: r.plan_id, name, sort: Math.max(0, ...(sts ?? []).map((s) => s.sort as number)) + 1 }).select('id').single();
      station = (made.data?.id as string | undefined) ?? null;
    }
  }
  const { data: last } = await svc.from('logistics_plan_slots').select('sort').eq('plan_id', r.plan_id).order('sort', { ascending: false }).limit(1).maybeSingle();
  let sort = (last?.sort as number | undefined) ?? 0;
  const rows: Record<string, unknown>[] = [];
  const row = (type: string, games: string[], set_id: string | null, what: string) => rows.push({ plan_id: r.plan_id, station_id: station, type, games, sort: ++sort, set_id, request_id: r.id, request_item: what });
  for (const { item, units } of add) {
    const parts = bundles.get(item.what.toLowerCase());
    for (let u = 0; u < units; u++) {
      if (!parts) { row(item.what, item.games, null, item.what); continue; }
      const set_id = crypto.randomUUID();
      parts.forEach((p, i) => { for (let k = 0; k < Math.max(1, p.qty); k++) row(p.type, i === 0 ? item.games : [], set_id, item.what); });
    }
  }
  const ins = await svc.from('logistics_plan_slots').insert(rows);
  if (ins.error) console.error('request rows', ins.error.message);
  return { kept };
}
