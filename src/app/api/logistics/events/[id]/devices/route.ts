import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LOCKED_MESSAGE, rowsLocked, UUID, touchPlan } from '@/lib/logistics/planServer';

export const dynamic = 'force-dynamic';
const ids = (v: unknown): string[] => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 500);

async function stationOk(svc: Parameters<typeof touchPlan>[0], planId: string, stationId: unknown): Promise<string | null | false> {
  if (stationId === null || stationId === undefined || stationId === '') return null;
  if (typeof stationId !== 'string' || !UUID.test(stationId)) return false;
  const { data } = await svc.from('logistics_stations').select('id').eq('id', stationId).eq('plan_id', planId).maybeSingle();
  return data ? stationId : false;
}

// Put devices in a plan (typed IDs resolve to ids on the client from the catalog it already has). Already there? Left as they are.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const deviceIds = ids(b.device_ids);
  if (!deviceIds.length) return NextResponse.json({ error: 'Pick at least one device.' }, { status: 400 });
  const station = await stationOk(auth.svc, id, b.station_id);
  if (station === false) return NextResponse.json({ error: 'That station is gone.' }, { status: 400 });
  const role = b.role === 'backup' ? 'backup' : 'planned';
  const { error } = await auth.svc.from('logistics_plan_devices').upsert(
    deviceIds.map((device_id) => ({ plan_id: id, device_id, station_id: station, role, added_by: auth.user.id })),
    { onConflict: 'plan_id,device_id', ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: 'Couldn’t add them.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true, added: deviceIds.length });
}

// Move devices to a station (or none), or change planned / backup.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const deviceIds = ids(b.device_ids);
  if (!deviceIds.length) return NextResponse.json({ error: 'Pick at least one device.' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if ('station_id' in b) {
    const s = await stationOk(auth.svc, id, b.station_id);
    if (s === false) return NextResponse.json({ error: 'That station is gone.' }, { status: 400 });
    patch.station_id = s;
  }
  if (b.role === 'planned' || b.role === 'backup') patch.role = b.role;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  if (await rowsLocked(auth.svc, id, { deviceIds })) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const { error } = await auth.svc.from('logistics_plan_devices').update(patch).eq('plan_id', id).in('device_id', deviceIds);
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const deviceIds = ids(b.device_ids);
  if (!deviceIds.length) return NextResponse.json({ error: 'Pick at least one device.' }, { status: 400 });
  if (await rowsLocked(auth.svc, id, { deviceIds })) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  await auth.svc.from('logistics_plan_devices').delete().eq('plan_id', id).in('device_id', deviceIds);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
