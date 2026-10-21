import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { DEVICE_COLUMNS, PLAN_COLUMNS, SLOT_COLUMNS, UUID, takenByOthers, touchPlan } from '@/lib/logistics/planServer';
import { isUsable, pickDevices } from '@/lib/logistics/plans';
import { cleanList, tagKey, type Device } from '@/lib/logistics/devices';

export const dynamic = 'force-dynamic';
const uuid = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);
const text = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null; };

async function stationOk(svc: import('@supabase/supabase-js').SupabaseClient, planId: string, v: unknown): Promise<string | null | false> {
  if (v === null || v === undefined || v === '') return null;
  const sid = uuid(v);
  if (!sid) return false;
  const { data } = await svc.from('logistics_stations').select('id').eq('id', sid).eq('plan_id', planId).maybeSingle();
  return data ? sid : false;
}

// Rows of a station allocated by TYPE ("Gaming PC, needs Valorant") that get a device later (or never, for counted things like a mousepad). Add them (several at once with count),
// change them, remove them, give one a device (`assign`, by typing its ID), or let the portal pick devices for the empty ones (`fill`).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const svc = auth.svc;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const { data: plan } = await svc.from('logistics_plans').select(PLAN_COLUMNS).eq('id', id).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'That plan is gone.' }, { status: 404 });

  // Give an empty row a device: type the ID. The row becomes that device, keeping the games it was asked to have.
  if (b.action === 'assign') {
    const slotId = uuid(b.slot_id);
    if (!slotId) return NextResponse.json({ error: 'Pick the row.' }, { status: 400 });
    const { data: slot } = await svc.from('logistics_plan_slots').select(SLOT_COLUMNS).eq('id', slotId).eq('plan_id', id).maybeSingle();
    if (!slot) return NextResponse.json({ error: 'That row is gone.' }, { status: 404 });
    if (!tagKey(b.tag)) return NextResponse.json({ error: 'Type the ID written on the device.' }, { status: 400 });
    const { data: dev } = await svc.from('logistics_devices').select(DEVICE_COLUMNS).eq('tag_key', tagKey(b.tag)).maybeSingle();
    if (!dev) return NextResponse.json({ error: `No device with the ID “${String(b.tag).trim()}”.` }, { status: 404 });
    const d = dev as unknown as Device;
    if (!isUsable(d)) return NextResponse.json({ error: `${d.tag} is marked ${d.condition.replace('_', ' ')}, so it can’t go out.` }, { status: 400 });
    const { data: there } = await svc.from('logistics_plan_devices').select('role').eq('plan_id', id).eq('device_id', d.id).maybeSingle();
    if (there?.role === 'planned') return NextResponse.json({ error: `${d.tag} is already in this plan.` }, { status: 409 });
    const row = { plan_id: id, device_id: d.id, station_id: slot.station_id, role: 'planned', games_needed: slot.games, sort: slot.sort, set_id: slot.set_id ?? null, request_id: slot.request_id ?? null, swap_reason: null, swapped_for_label: null, added_by: auth.user.id };
    const { error } = await svc.from('logistics_plan_devices').upsert(row, { onConflict: 'plan_id,device_id' });
    if (error) return NextResponse.json({ error: 'Couldn’t give it the device.' }, { status: 500 });
    await svc.from('logistics_plan_slots').delete().eq('id', slotId);
    await touchPlan(svc, id);
    return NextResponse.json({ ok: true });
  }

  // Empty a row: the device goes back to the shelf and the row waits for another. Only for rows a request made.
  if (b.action === 'empty') {
    const deviceId = uuid(b.device_id);
    if (!deviceId) return NextResponse.json({ error: 'Pick the device.' }, { status: 400 });
    const { data: pd } = await svc.from('logistics_plan_devices').select('station_id, games_needed, sort, set_id, request_id, role').eq('plan_id', id).eq('device_id', deviceId).maybeSingle();
    if (!pd || pd.role !== 'planned') return NextResponse.json({ error: 'That device isn’t in the plan.' }, { status: 404 });
    if (!pd.request_id) return NextResponse.json({ error: 'That row didn’t come from a request.' }, { status: 400 });
    const { data: dev } = await svc.from('logistics_devices').select('type').eq('id', deviceId).maybeSingle();
    await svc.from('logistics_plan_devices').delete().eq('plan_id', id).eq('device_id', deviceId);
    await svc.from('logistics_plan_slots').insert({ plan_id: id, station_id: pd.station_id, type: (dev?.type as string | undefined) ?? 'Device', games: pd.games_needed ?? [], sort: pd.sort, set_id: pd.set_id, request_id: pd.request_id });
    await touchPlan(svc, id);
    return NextResponse.json({ ok: true });
  }

  // Let the portal choose devices for the empty rows (counted things are left alone). Without apply it only previews.
  if (b.action === 'fill') {
    const station = uuid(b.station_id);
    let q = svc.from('logistics_plan_slots').select(SLOT_COLUMNS).eq('plan_id', id).order('sort');
    if (station) q = q.eq('station_id', station);
    const [{ data: slots }, { data: all }, { data: inPlan }, others, { data: typeOpts }] = await Promise.all([
      q, svc.from('logistics_devices').select(DEVICE_COLUMNS).limit(5000),
      svc.from('logistics_plan_devices').select('device_id').eq('plan_id', id),
      takenByOthers(svc, plan as { id: string; starts_on: string; ends_on: string }),
      svc.from('logistics_options').select('value, meta').eq('kind', 'type'),
    ]);
    const counted = new Set((typeOpts ?? []).filter((t) => (t.meta as { counted?: boolean } | null)?.counted).map((t) => (t.value as string).toLowerCase()));
    const used = new Set([...others, ...(inPlan ?? []).map((r) => r.device_id as string)]);
    const devices = (all ?? []) as unknown as Device[];
    const picks: { slot: { id: string; station_id: string | null; type: string; games: string[] }; device: Device | null }[] = [];
    for (const s of (slots ?? []) as unknown as { id: string; station_id: string | null; type: string; games: string[] }[]) {
      if (counted.has(s.type.toLowerCase())) continue;
      const r = pickDevices(devices, { type: s.type, count: 1, games: s.games, taken: used });
      const d = r.picked[0] ?? null;
      if (d) used.add(d.id);
      picks.push({ slot: s, device: d });
    }
    const preview = picks.map((p) => ({ slot_id: p.slot.id, type: p.slot.type, games: p.slot.games, device: p.device ? { id: p.device.id, tag: p.device.tag, condition: p.device.condition, games: p.device.games } : null }));
    if (b.apply !== true) return NextResponse.json({ preview });
    const chosen = picks.filter((p) => p.device);
    if (chosen.length) {
      await svc.from('logistics_plan_devices').insert(chosen.map((p) => ({ plan_id: id, device_id: p.device!.id, station_id: p.slot.station_id, role: 'planned', games_needed: p.slot.games, sort: (slots ?? []).find((x) => x.id === p.slot.id)?.sort ?? 1000, set_id: (slots ?? []).find((x) => x.id === p.slot.id)?.set_id ?? null, added_by: auth.user.id })));
      await svc.from('logistics_plan_slots').delete().in('id', chosen.map((p) => p.slot.id));
    }
    await touchPlan(svc, id);
    return NextResponse.json({ preview, applied: chosen.length });
  }

  const type = text(b.type, 80);
  if (!type) return NextResponse.json({ error: 'Say what kind of device the row is for.' }, { status: 400 });
  const station = await stationOk(svc, id, b.station_id);
  if (station === false) return NextResponse.json({ error: 'That station is gone.' }, { status: 400 });
  const count = Math.min(50, Math.max(1, Math.round(Number(b.count)) || 1));
  const { data: last } = await svc.from('logistics_plan_slots').select('sort').eq('plan_id', id).order('sort', { ascending: false }).limit(1).maybeSingle();
  let sort = (last?.sort as number | undefined) ?? 0;
  const { data, error } = await svc.from('logistics_plan_slots').insert(Array.from({ length: count }, () => ({ plan_id: id, station_id: station, type, games: cleanList(b.games, 10), label: text(b.label, 120), sort: ++sort }))).select(SLOT_COLUMNS);
  if (error) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  await touchPlan(svc, id);
  return NextResponse.json({ slots: data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const ids = (Array.isArray(b.slot_ids) ? b.slot_ids : [b.slot_id]).map((x: unknown) => uuid(x)).filter((x: string | null): x is string => !!x);
  if (!UUID.test(id) || !ids.length) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if ('type' in b) { const t = text(b.type, 80); if (!t) return NextResponse.json({ error: 'Say what kind of device the row is for.' }, { status: 400 }); patch.type = t; }
  if ('games' in b) patch.games = cleanList(b.games, 10);
  if ('label' in b) patch.label = text(b.label, 120);
  if ('station_id' in b) { const s = await stationOk(auth.svc, id, b.station_id); if (s === false) return NextResponse.json({ error: 'That station is gone.' }, { status: 400 }); patch.station_id = s; }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { error } = await auth.svc.from('logistics_plan_slots').update(patch).eq('plan_id', id).in('id', ids);
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const ids = (Array.isArray(b.slot_ids) ? b.slot_ids : [b.slot_id]).map((x: unknown) => uuid(x)).filter((x: string | null): x is string => !!x);
  if (!UUID.test(id) || !ids.length) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await auth.svc.from('logistics_plan_slots').delete().eq('plan_id', id).in('id', ids);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
