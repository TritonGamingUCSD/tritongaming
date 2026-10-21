import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { DEVICE_COLUMNS, PLAN_COLUMNS, UUID, takenByOthers, touchPlan } from '@/lib/logistics/planServer';
import { pickBundle, pickDevices, type Cell } from '@/lib/logistics/plans';
import type { Device } from '@/lib/logistics/devices';
import { cleanList } from '@/lib/logistics/devices';

export const dynamic = 'force-dynamic';

const view = (cells: Cell[], counted: Set<string>) => cells.map((c) => ({ type: c.type, games: c.games, counted: counted.has(c.type.toLowerCase()), device: c.device ? { id: c.device.id, tag: c.device.tag, shelf: c.device.shelf, tier: c.device.tier, condition: c.device.condition } : null }));

// Choose what goes into a plan by type and count ("10 monitors") or by bundle ("PC Station ×5"). A bundle makes its stations, a row for every item; devices are chosen for the rows
// (Working and Brand New first, devices that already have the wanted games first) and a row with no device available stays as an empty row to fill later (counted things like a
// mousepad always stay as rows, one per unit). Without apply it only previews. Devices already in this plan, or booked for another event on overlapping dates, are never chosen.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const svc = auth.svc;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const { data: plan } = await svc.from('logistics_plans').select(PLAN_COLUMNS).eq('id', id).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'That plan is gone.' }, { status: 404 });
  const games = cleanList(b.games, 10);
  const apply = b.apply === true;
  const [{ data: all }, { data: inPlan }, others, { data: typeOpts }] = await Promise.all([
    svc.from('logistics_devices').select(DEVICE_COLUMNS).limit(5000),
    svc.from('logistics_plan_devices').select('device_id').eq('plan_id', id),
    takenByOthers(svc, plan as { id: string; starts_on: string; ends_on: string }),
    svc.from('logistics_options').select('value, meta').eq('kind', 'type'),
  ]);
  const taken = new Set([...others, ...(inPlan ?? []).map((r) => r.device_id as string)]);
  const devices = (all ?? []) as unknown as Device[];
  const counted = new Set((typeOpts ?? []).filter((t) => (t.meta as { counted?: boolean } | null)?.counted).map((t) => (t.value as string).toLowerCase()));
  const cellsOf = (stations: Cell[][]) => stations.map((s) => view(s, counted));

  // Rows into the plan: a chosen device is added with the games it was asked to have; no device means an empty row.
  async function write(stationId: string | null, cells: Cell[], sortFrom: number, setId: string | null = null) {
    let sort = sortFrom;
    const order = cells.map(() => ++sort);   // every row keeps its place, device or not
    const devs = cells.flatMap((c, i) => (c.device ? [{ plan_id: id, device_id: c.device.id, station_id: stationId, role: 'planned', games_needed: c.games, sort: order[i], set_id: setId, added_by: auth.user!.id }] : []));
    const slots = cells.flatMap((c, i) => (c.device ? [] : [{ plan_id: id, station_id: stationId, type: c.type, games: c.games, sort: order[i], set_id: setId }]));
    if (devs.length) await svc.from('logistics_plan_devices').insert(devs);
    if (slots.length) await svc.from('logistics_plan_slots').insert(slots);
  }

  if (typeof b.bundle_id === 'string') {
    const { data: bundle } = await svc.from('logistics_options').select('value, meta').eq('id', b.bundle_id).eq('kind', 'bundle').maybeSingle();
    if (!bundle) return NextResponse.json({ error: 'That bundle is gone.' }, { status: 404 });
    const count = Math.min(40, Math.max(1, Math.round(Number(b.count)) || 1));
    const items = ((bundle.meta as { items?: { type: string; qty: number }[] } | null)?.items ?? []);
    const r = pickBundle(devices, items, count, games, taken, counted);
    const empty = r.stations.flat().filter((c) => !c.device && !counted.has(c.type.toLowerCase())).length;
    const preview = { stations: cellsOf(r.stations), short: r.short, notTested: r.notTested, missingGames: r.missingGames, empty };
    if (!apply) return NextResponse.json({ preview });
    // Into a team that exists already: every set goes in as more rows of that team. Otherwise each set gets a new team of its own.
    let into: string | null = null;
    if (typeof b.station_id === 'string' && UUID.test(b.station_id)) { const { data: s } = await svc.from('logistics_stations').select('id').eq('id', b.station_id).eq('plan_id', id).maybeSingle(); into = (s?.id as string | undefined) ?? null; }
    const setOf = (cells: Cell[]) => (cells.length > 1 ? crypto.randomUUID() : null);
    if (into) {
      const [{ data: d1 }, { data: d2 }] = await Promise.all([
        svc.from('logistics_plan_devices').select('sort').eq('plan_id', id).eq('station_id', into).order('sort', { ascending: false }).limit(1).maybeSingle(),
        svc.from('logistics_plan_slots').select('sort').eq('plan_id', id).eq('station_id', into).order('sort', { ascending: false }).limit(1).maybeSingle(),
      ]);
      let from = Math.max(0, (d1?.sort as number | undefined) ?? 0, (d2?.sort as number | undefined) ?? 0);
      for (const cells of r.stations) { await write(into, cells, from, setOf(cells)); from += cells.length; }
      await touchPlan(svc, id);
      return NextResponse.json({ preview, applied: r.stations.flat().length });
    }
    const { data: existing } = await svc.from('logistics_stations').select('name, sort').eq('plan_id', id);
    const prefix = String(bundle.value);
    const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
    let n = Math.max(0, ...(existing ?? []).map((s) => Number(re.exec(s.name as string)?.[1] ?? 0)));
    let sort = Math.max(0, ...(existing ?? []).map((s) => s.sort as number));
    const made = await svc.from('logistics_stations').insert(r.stations.map(() => ({ plan_id: id, name: `${prefix} ${++n}`, sort: ++sort }))).select('id, name');
    if (made.error || !made.data) return NextResponse.json({ error: 'Couldn’t make the stations.' }, { status: 500 });
    for (let i = 0; i < r.stations.length; i++) await write(made.data[i].id as string, r.stations[i], 0, setOf(r.stations[i]));
    await touchPlan(svc, id);
    return NextResponse.json({ preview, applied: r.stations.flat().length });
  }

  const type = String(b.type ?? '').trim();
  if (!type) return NextResponse.json({ error: 'Pick a device type or a bundle.' }, { status: 400 });
  const count = Math.min(500, Math.max(1, Math.round(Number(b.count)) || 1));
  const isCounted = counted.has(type.toLowerCase());
  const r = isCounted ? { picked: [] as Device[], short: 0, notTested: 0, missingGames: 0 } : pickDevices(devices, { type, count, games, taken });
  const cells: Cell[] = Array.from({ length: count }, (_, i) => ({ type, games, device: r.picked[i] ?? null }));
  const preview = { stations: cellsOf([cells]), short: r.short, notTested: r.notTested, missingGames: r.missingGames, empty: isCounted ? 0 : r.short };
  if (!apply) return NextResponse.json({ preview });
  let station: string | null = null;
  if (typeof b.station_id === 'string' && UUID.test(b.station_id)) { const { data: s } = await svc.from('logistics_stations').select('id').eq('id', b.station_id).eq('plan_id', id).maybeSingle(); station = (s?.id as string | undefined) ?? null; }
  const { data: last } = await svc.from('logistics_plan_slots').select('sort').eq('plan_id', id).order('sort', { ascending: false }).limit(1).maybeSingle();
  await write(station, cells, (last?.sort as number | undefined) ?? 0);
  await touchPlan(svc, id);
  return NextResponse.json({ preview, applied: cells.length });
}
