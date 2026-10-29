import type { SupabaseClient } from '@supabase/supabase-js';
import { prizeSizes, type DeviceItem, type PrizeItem } from './requests';

// What a device request turns into in the allocation: one empty row per unit. A bundle line makes a set per unit (a row for every item of the bundle, quantity 2 = two rows).
export interface Want {
  type: string;
  games: string[];
  set: number | null;
}
export function wantedRows(items: DeviceItem[], bundles: Map<string, { type: string; qty: number }[]>): Want[] {
  const out: Want[] = [];
  let set = 0;
  for (const it of items) {
    const parts = bundles.get(it.what.toLowerCase());
    for (let u = 0; u < it.qty; u++) {
      if (!parts) {
        out.push({ type: it.what, games: it.games, set: null });
        continue;
      }
      set += 1;
      parts.forEach((p, i) => {
        for (let k = 0; k < Math.max(1, p.qty); k++) out.push({ type: p.type, games: i === 0 ? it.games : [], set });
      });
    }
  }
  return out;
}

// How many rows of each type to add (positive) or take away (negative), comparing what the request wants with what its rows already are.
export function rowDiff(want: Want[], have: Map<string, number>): Map<string, number> {
  const need = new Map<string, number>();
  for (const w of want) need.set(w.type.toLowerCase(), (need.get(w.type.toLowerCase()) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const k of new Set([...need.keys(), ...have.keys()])) {
    const d = (need.get(k) ?? 0) - (have.get(k) ?? 0);
    if (d) out.set(k, d);
  }
  return out;
}

interface Req {
  id: string;
  plan_id: string;
  kind: string;
  team: string | null;
  contact?: string | null;
  division_id: string | null;
  items: unknown;
  status: string;
}
interface RowRef {
  id: string;
  sort: number;
  set_id: string | null;
  key: string;
  slot: boolean;
  loan?: boolean;
  locked: boolean;
  type: string;
  station: string | null;
}

// Make the plan's rows match one device request, line by line. A bundle line is whole sets (a row for every item of the bundle, one set per unit); a type line is plain rows. More
// units add empty rows; fewer take away the extras, empty ones first and then ones with a device (it goes back to storage), except a device with an event-day step done (the count that
// stays is returned). A declined request keeps no rows. The team is found by name (the request's team, else its division) or made.
export async function syncRequestRows(svc: SupabaseClient, r: Req): Promise<{ kept: number }> {
  if (r.kind !== 'devices') return { kept: 0 };
  // Two people saving the same request at once could each add the missing rows; a second pass sees the real count and takes the extra empty rows away again.
  let out = await syncRows(svc, r);
  if (out.changed) out = await syncRows(svc, r);
  await writeContact(svc, r);
  return { kept: out.kept };
}

async function syncRows(svc: SupabaseClient, r: Req): Promise<{ kept: number; changed: boolean }> {
  const [{ data: slots }, { data: devs }, { data: opts }, { data: loans }] = await Promise.all([
    svc.from('logistics_plan_slots').select('id, type, sort, set_id, request_item, station_id').eq('request_id', r.id),
    svc.from('logistics_plan_devices').select('device_id, sort, set_id, request_item, station_id').eq('request_id', r.id),
    svc.from('logistics_options').select('value, meta').eq('kind', 'bundle'),
    svc.from('logistics_plan_borrowed').select('id, type, sort, set_id, request_item, station_id').eq('request_id', r.id),
  ]);
  const ids = (devs ?? []).map((d) => d.device_id as string);
  const { data: dd } = ids.length ? await svc.from('logistics_devices').select('id, type').in('id', ids) : { data: [] };
  // A device that already has an event-day step done is part of the record, so it is never taken out.
  const { data: ticks } = ids.length ? await svc.from('logistics_plan_steps').select('device_id').eq('plan_id', r.plan_id).in('device_id', ids) : { data: [] };
  const loanIds = (loans ?? []).map((l) => l.id as string);
  const { data: loanTicks } = loanIds.length ? await svc.from('logistics_plan_steps').select('borrowed_id').eq('plan_id', r.plan_id).in('borrowed_id', loanIds) : { data: [] };
  const started = new Set([...(ticks ?? []).map((x) => x.device_id as string), ...(loanTicks ?? []).map((x) => x.borrowed_id as string)]);
  const typeOf = new Map((dd ?? []).map((d) => [d.id as string, d.type as string]));
  const bundles = new Map((opts ?? []).map((o) => [String(o.value).toLowerCase(), (o.meta as { items?: { type: string; qty: number }[] } | null)?.items ?? []]));
  const items: DeviceItem[] = r.status === 'declined' ? [] : ((r.items as DeviceItem[]) ?? []);
  const refs: RowRef[] = [
    ...(slots ?? []).map((x) => ({
      id: x.id as string,
      sort: x.sort as number,
      set_id: x.set_id as string | null,
      key: String(x.request_item ?? x.type).toLowerCase(),
      slot: true,
      locked: false,
      type: x.type as string,
      station: x.station_id as string | null,
    })),
    ...(devs ?? []).map((x) => ({
      id: x.device_id as string,
      sort: x.sort as number,
      set_id: x.set_id as string | null,
      key: String(x.request_item ?? typeOf.get(x.device_id as string) ?? '').toLowerCase(),
      slot: false,
      locked: started.has(x.device_id as string),
      type: typeOf.get(x.device_id as string) ?? '',
      station: x.station_id as string | null,
    })),
    ...(loans ?? []).map((x) => ({
      id: x.id as string,
      sort: x.sort as number,
      set_id: x.set_id as string | null,
      key: String(x.request_item ?? x.type).toLowerCase(),
      slot: false,
      loan: true,
      locked: started.has(x.id as string),
      type: x.type as string,
      station: x.station_id as string | null,
    })),
  ];
  const wanted = new Set(items.map((i) => i.what.toLowerCase()));
  const drop: string[] = [];
  const dropDev: string[] = [];
  const dropLoan: string[] = [];
  // Take away what is no longer asked for: empty rows first, then ones with a device (which goes back to storage), the last-added first.
  const cutOf = (groups: RowRef[][], n: number) =>
    groups
      .filter((g) => !g.some((x) => x.locked))
      .sort((a, b) =>
        Number(a.every((x) => x.slot)) === Number(b.every((x) => x.slot))
          ? Math.max(...b.map((x) => x.sort)) - Math.max(...a.map((x) => x.sort))
          : Number(b.every((x) => x.slot)) - Number(a.every((x) => x.slot)),
      )
      .slice(0, n);
  let kept = 0;
  const add: { item: DeviceItem; units: number }[] = [];
  const reshape: { item: DeviceItem; group: RowRef[] }[] = [];

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
      const cut = have > need ? cutOf([...sets.values()], have - need) : [];
      for (const g of cut) for (const x of g) (x.slot ? drop : x.loan ? dropLoan : dropDev).push(x.id);
      kept += Math.max(0, have - need) - cut.length;
      if (item) for (const g of sets.values()) if (!cut.includes(g)) reshape.push({ item, group: g });
    } else {
      const have = mine.length;
      if (have < need && item) add.push({ item, units: need - have });
      if (have > need) {
        const cut = cutOf(
          mine.map((x) => [x]),
          have - need,
        ).map((g) => g[0]);
        for (const x of cut) (x.slot ? drop : x.loan ? dropLoan : dropDev).push(x.id);
        kept += have - need - cut.length;
      }
    }
  }
  // A bundle that was edited: every set it made gets the parts it now has (new ones empty, ones it dropped taken away, empty rows first).
  const fix: Record<string, unknown>[] = [];
  for (const { item, group } of reshape) {
    const want = new Map<string, number>();
    for (const p of bundles.get(item.what.toLowerCase()) ?? []) want.set(p.type.toLowerCase(), (want.get(p.type.toLowerCase()) ?? 0) + Math.max(1, p.qty));
    const have = new Map<string, RowRef[]>();
    for (const x of group) have.set(x.type.toLowerCase(), [...(have.get(x.type.toLowerCase()) ?? []), x]);
    for (const [t, n] of want) {
      const miss = n - (have.get(t)?.length ?? 0);
      for (let i = 0; i < miss; i++)
        fix.push({
          plan_id: r.plan_id,
          station_id: group[0].station,
          type: (bundles.get(item.what.toLowerCase()) ?? []).find((p) => p.type.toLowerCase() === t)?.type ?? t,
          games: [],
          set_id: group[0].set_id,
          request_id: r.id,
          request_item: item.what,
          t,
        });
    }
    for (const [t, list] of have) {
      const extra = list.length - (want.get(t) ?? 0);
      if (extra <= 0) continue;
      const cut = list
        .filter((x) => !x.locked)
        .sort((a, b) => Number(b.slot) - Number(a.slot) || b.sort - a.sort)
        .slice(0, extra);
      for (const x of cut) (x.slot ? drop : x.loan ? dropLoan : dropDev).push(x.id);
      kept += extra - cut.length;
    }
  }
  if (drop.length) await svc.from('logistics_plan_slots').delete().in('id', drop);
  if (dropLoan.length)
    await svc.from('logistics_plan_borrowed').update({ station_id: null, set_id: null, request_id: null, request_item: null, games_needed: [] }).in('id', dropLoan);
  if (dropDev.length) await svc.from('logistics_plan_devices').delete().eq('plan_id', r.plan_id).in('device_id', dropDev);
  if (fix.length) {
    const { data: lastSort } = await svc.from('logistics_plan_slots').select('sort').eq('plan_id', r.plan_id).order('sort', { ascending: false }).limit(1).maybeSingle();
    let n = (lastSort?.sort as number | undefined) ?? 0;
    await svc.from('logistics_plan_slots').insert(fix.map(({ t: _t, ...row }) => ({ ...row, sort: ++n })));
  }
  if (!add.length) return { kept, changed: drop.length + dropDev.length + dropLoan.length + fix.length > 0 };

  let name = r.team?.trim() || null;
  if (!name && r.division_id) name = ((await svc.from('divisions').select('name').eq('id', r.division_id).maybeSingle()).data?.name as string | undefined) ?? null;
  let station: string | null = null;
  if (name) {
    const { data: sts } = await svc.from('logistics_stations').select('id, name, sort').eq('plan_id', r.plan_id);
    const hit = (sts ?? []).find((s) => (s.name as string).toLowerCase() === name!.toLowerCase());
    if (hit) station = hit.id as string;
    else {
      const made = await svc
        .from('logistics_stations')
        .insert({ plan_id: r.plan_id, name, sort: Math.max(0, ...(sts ?? []).map((s) => s.sort as number)) + 1 })
        .select('id')
        .single();
      station = (made.data?.id as string | undefined) ?? null;
    }
  }
  const { data: last } = await svc.from('logistics_plan_slots').select('sort').eq('plan_id', r.plan_id).order('sort', { ascending: false }).limit(1).maybeSingle();
  let sort = (last?.sort as number | undefined) ?? 0;
  const rows: Record<string, unknown>[] = [];
  const row = (type: string, games: string[], set_id: string | null, what: string) =>
    rows.push({ plan_id: r.plan_id, station_id: station, type, games, sort: ++sort, set_id, request_id: r.id, request_item: what });
  for (const { item, units } of add) {
    const parts = bundles.get(item.what.toLowerCase());
    for (let u = 0; u < units; u++) {
      if (!parts) {
        row(item.what, item.games, null, item.what);
        continue;
      }
      const set_id = crypto.randomUUID();
      parts.forEach((p, i) => {
        for (let k = 0; k < Math.max(1, p.qty); k++) row(p.type, i === 0 ? item.games : [], set_id, item.what);
      });
    }
  }
  const ins = await svc.from('logistics_plan_slots').insert(rows);
  if (ins.error) console.error('request rows', ins.error.message);
  return { kept, changed: true };
}

// The request's contact becomes its team's contact (the team is found by the request's team name, else its division's), so every page shows the same one.
async function writeContact(svc: SupabaseClient, r: Req): Promise<void> {
  if (r.contact === undefined) return;
  let name = r.team?.trim() || null;
  if (!name && r.division_id) name = ((await svc.from('divisions').select('name').eq('id', r.division_id).maybeSingle()).data?.name as string | undefined) ?? null;
  if (!name) return;
  const { data: sts } = await svc.from('logistics_stations').select('id, name').eq('plan_id', r.plan_id);
  const hit = (sts ?? []).find((x) => (x.name as string).toLowerCase() === name!.toLowerCase());
  if (hit)
    await svc
      .from('logistics_stations')
      .update({ contact: r.contact })
      .eq('id', hit.id as string);
}

// A bundle was renamed or its parts changed: the open events' requests that ask for it follow (the name in the request and its rows, then the rows themselves are matched again).
export async function followBundle(svc: SupabaseClient, oldName: string, newName: string): Promise<void> {
  const { data: reqs } = await svc.from('logistics_requests').select('id, plan_id, kind, team, division_id, items, status').eq('kind', 'devices').limit(3000);
  const using = (reqs ?? []).filter((q) => ((q.items as DeviceItem[]) ?? []).some((i) => i.what.toLowerCase() === oldName.toLowerCase()));
  if (!using.length) return;
  const { data: plans } = await svc
    .from('logistics_plans')
    .select('id, status')
    .in('id', [...new Set(using.map((q) => q.plan_id as string))]);
  const open = new Set((plans ?? []).filter((p) => p.status !== 'closed').map((p) => p.id as string));
  for (const q of using) {
    if (!open.has(q.plan_id as string)) continue;
    let row = q as unknown as Req;
    if (newName !== oldName) {
      const items = (q.items as DeviceItem[]).map((i) => (i.what.toLowerCase() === oldName.toLowerCase() ? { ...i, what: newName } : i));
      await svc
        .from('logistics_requests')
        .update({ items })
        .eq('id', q.id as string);
      await svc
        .from('logistics_plan_slots')
        .update({ request_item: newName })
        .eq('request_id', q.id as string)
        .ilike(
          'request_item',
          oldName.replace(/[%_]/g, (c) => `\\${c}`),
        );
      await svc
        .from('logistics_plan_devices')
        .update({ request_item: newName })
        .eq('request_id', q.id as string)
        .ilike(
          'request_item',
          oldName.replace(/[%_]/g, (c) => `\\${c}`),
        );
      row = { ...row, items };
    }
    await syncRequestRows(svc, row);
  }
}

// How many device requests ask for a bundle (so it can't be deleted while one does).
export async function requestsUsingBundle(svc: SupabaseClient, name: string): Promise<number> {
  const { data } = await svc.from('logistics_requests').select('items').eq('kind', 'devices').limit(3000);
  return (data ?? []).filter((q) => ((q.items as DeviceItem[]) ?? []).some((i) => i.what.toLowerCase() === name.toLowerCase())).length;
}

// A prize request is a station for its team: it says how many prizes of each size, which the prizing page shows as progress and fills on Suggest. It uses the team's own station when the
// plan has one with that name, otherwise it makes a station for prizes only. When the request shrinks, the station's lines are trimmed to fit, newest first, but never below what has already
// been counted in a step. A declined request takes its prizes away (and a station made only for it) unless prizes were already counted.
export async function syncPrizeStation(svc: SupabaseClient, r: Req & { requester_id?: string }): Promise<void> {
  if (r.kind !== 'prizes') return;
  const items = (r.items as PrizeItem[]) ?? [];
  const qty = items.reduce((n, i) => n + i.qty, 0);
  let { data: station } = await svc.from('logistics_stations').select('id, prize_only').eq('prize_request_id', r.id).maybeSingle();
  const own = !!station; // the station this request made (or took) earlier
  const { data: lines } = station
    ? await svc
        .from('logistics_plan_prizes')
        .select('id, quantity, sort')
        .eq('station_id', station.id as string)
        .order('sort', { ascending: false })
    : { data: [] };
  const lineIds = (lines ?? []).map((l) => l.id as string);
  const { data: counted } = lineIds.length ? await svc.from('logistics_plan_prize_steps').select('line_id, done').in('line_id', lineIds) : { data: [] };
  const floor = new Map<string, number>();
  for (const c of counted ?? []) floor.set(c.line_id as string, Math.max(floor.get(c.line_id as string) ?? 0, c.done as number));
  if (r.status === 'declined') {
    if (station && ![...floor.values()].some((n) => n > 0)) {
      if (station.prize_only)
        await svc
          .from('logistics_stations')
          .delete()
          .eq('id', station.id as string);
      else {
        await svc
          .from('logistics_plan_prizes')
          .delete()
          .eq('station_id', station.id as string);
        await svc
          .from('logistics_stations')
          .update({ prize_request_id: null, prize_target_qty: null, prize_target_sizes: null })
          .eq('id', station.id as string);
      }
    }
    return;
  }
  let name = r.team?.trim() || null;
  if (!name && r.requester_id) name = ((await svc.from('profiles').select('display_name').eq('id', r.requester_id).maybeSingle()).data?.display_name as string | undefined) ?? null;
  const { data: sts } = await svc.from('logistics_stations').select('id, name, prize_only, prize_request_id, sort').eq('plan_id', r.plan_id);
  if (!station && r.team) {
    const team = (sts ?? []).find((x) => (x.name as string).toLowerCase() === r.team!.trim().toLowerCase() && !x.prize_request_id);
    if (team) station = { id: team.id as string, prize_only: !!team.prize_only };
  }
  const fields = { prize_request_id: r.id, prize_target_qty: qty > 0 ? qty : null, prize_target_sizes: qty > 0 ? prizeSizes(items) : null };
  if (!station) {
    const last = Math.max(0, ...(sts ?? []).map((x) => x.sort as number));
    await svc.from('logistics_stations').insert({ ...fields, plan_id: r.plan_id, name: (name ?? 'Prizes').slice(0, 80), sort: last + 1, prize_only: true });
    return;
  }
  await svc
    .from('logistics_stations')
    .update(own && station.prize_only ? { ...fields, name: (name ?? 'Prizes').slice(0, 80) } : fields)
    .eq('id', station.id as string);
  if (qty === 0) return; // no amount asked for: whatever the logistics team puts on the station stays
  let extra = (lines ?? []).reduce((n, l) => n + (l.quantity as number), 0) - qty;
  for (const l of lines ?? []) {
    if (extra <= 0) break;
    const room = (l.quantity as number) - (floor.get(l.id as string) ?? 0);
    const cut = Math.min(extra, Math.max(0, room));
    if (!cut) continue;
    if ((l.quantity as number) - cut <= 0)
      await svc
        .from('logistics_plan_prizes')
        .delete()
        .eq('id', l.id as string);
    else
      await svc
        .from('logistics_plan_prizes')
        .update({ quantity: (l.quantity as number) - cut })
        .eq('id', l.id as string);
    extra -= cut;
  }
}
