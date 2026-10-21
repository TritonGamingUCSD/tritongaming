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

// Make the plan's rows match one device request: its team is found or made, missing rows are added empty, and rows no longer wanted go only if they are still empty (a device
// already given stays; the count of those is returned so the logistics team can be told). A declined request keeps no empty rows.
export async function syncRequestRows(svc: SupabaseClient, r: Req): Promise<{ kept: number }> {
  if (r.kind !== 'devices') return { kept: 0 };
  const [{ data: slots }, { data: devs }, { data: opts }] = await Promise.all([
    svc.from('logistics_plan_slots').select('id, type, sort').eq('request_id', r.id),
    svc.from('logistics_plan_devices').select('device_id').eq('request_id', r.id),
    svc.from('logistics_options').select('kind, value, meta').in('kind', ['bundle']),
  ]);
  const ids = (devs ?? []).map((d) => d.device_id as string);
  const { data: dd } = ids.length ? await svc.from('logistics_devices').select('id, type').in('id', ids) : { data: [] };
  const have = new Map<string, number>();
  for (const t of [...(slots ?? []).map((s) => s.type as string), ...(dd ?? []).map((d) => d.type as string)]) have.set(t.toLowerCase(), (have.get(t.toLowerCase()) ?? 0) + 1);
  const bundles = new Map((opts ?? []).map((o) => [String(o.value).toLowerCase(), ((o.meta as { items?: { type: string; qty: number }[] } | null)?.items ?? [])]));
  const want = r.status === 'declined' ? [] : wantedRows((r.items as DeviceItem[]) ?? [], bundles);
  const diff = rowDiff(want, have);
  let kept = 0;
  const drop: string[] = [];
  for (const [type, d] of diff) {
    if (d >= 0) continue;
    const mine = (slots ?? []).filter((s) => (s.type as string).toLowerCase() === type).sort((a, b) => (b.sort as number) - (a.sort as number));
    drop.push(...mine.slice(0, -d).map((s) => s.id as string));
    kept += -d - Math.min(-d, mine.length);
  }
  if (drop.length) await svc.from('logistics_plan_slots').delete().in('id', drop);
  const add = [...diff].filter(([, d]) => d > 0);
  if (!add.length) return { kept };

  // The team: the name given, else the division's name; found by name or made.
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
  // A brand-new request keeps its bundle sets together; later additions are plain rows of the type.
  const fresh = (slots ?? []).length + ids.length === 0;
  const setIds = new Map<number, string>();
  const setSize = new Map<number, number>();
  if (fresh) for (const w of want) if (w.set) setSize.set(w.set, (setSize.get(w.set) ?? 0) + 1);
  let rows: { plan_id: string; station_id: string | null; type: string; games: string[]; sort: number; set_id: string | null; request_id: string }[];
  if (fresh) {
    rows = want.map((w) => ({ plan_id: r.plan_id, station_id: station, type: w.type, games: w.games, sort: ++sort, set_id: w.set && (setSize.get(w.set) ?? 0) > 1 ? (setIds.get(w.set) ?? (setIds.set(w.set, crypto.randomUUID()), setIds.get(w.set)!)) : null, request_id: r.id }));
  } else {
    const games = new Map<string, string[]>();
    for (const w of want) if (!games.has(w.type.toLowerCase())) games.set(w.type.toLowerCase(), w.games);
    const typeName = new Map(want.map((w) => [w.type.toLowerCase(), w.type]));
    rows = add.flatMap(([type, d]) => Array.from({ length: d }, () => ({ plan_id: r.plan_id, station_id: station, type: typeName.get(type) ?? type, games: games.get(type) ?? [], sort: ++sort, set_id: null, request_id: r.id })));
  }
  if (rows.length) { const ins = await svc.from('logistics_plan_slots').insert(rows); if (ins.error) console.error('request rows', ins.error.message); }
  return { kept };
}
