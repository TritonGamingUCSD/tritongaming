import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LOCKED_MESSAGE, lockedRequestIds, UUID, touchPlan } from '@/lib/logistics/planServer';

export const dynamic = 'force-dynamic';
const name = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
const text = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null; };

// Stations: the named places in an event (Smash Table 1, Main Stage) that devices are assigned to. Made per plan.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const names: string[] = (Array.isArray(b.names) ? b.names : [b.name]).map(name).filter(Boolean).slice(0, 40);
  if (!names.length) return NextResponse.json({ error: 'Type a name for the station.' }, { status: 400 });
  const { data: last } = await auth.svc.from('logistics_stations').select('sort').eq('plan_id', id).order('sort', { ascending: false }).limit(1).maybeSingle();
  let sort = (last?.sort as number | undefined) ?? 0;
  const extra = { contact: text(b.contact, 200), room: text(b.room, 120) };
  const { data, error } = await auth.svc.from('logistics_stations').insert(names.map((n) => ({ plan_id: id, name: n, sort: ++sort, ...extra }))).select('id, name, sort, contact, room');
  if (error) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ stations: data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.station_id !== 'string' || !UUID.test(b.station_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if ('name' in b) { const n = name(b.name); if (!n) return NextResponse.json({ error: 'The name can’t be empty.' }, { status: 400 }); patch.name = n; }
  if ('contact' in b) patch.contact = text(b.contact, 200);
  if ('room' in b) patch.room = text(b.room, 120);
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { data, error } = await auth.svc.from('logistics_stations').update(patch).eq('id', b.station_id).eq('plan_id', id).select('id, name, sort, contact, room').single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ station: data });
}

// Removing a station leaves its devices in the plan, unassigned.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.station_id !== 'string' || !UUID.test(b.station_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const locked = [...(await lockedRequestIds(auth.svc, id))];
  if (locked.length) {   // removing a team would unassign the rows of a locked request
    const held = await Promise.all(['logistics_plan_devices', 'logistics_plan_borrowed', 'logistics_plan_slots'].map((t) => auth.svc.from(t).select('plan_id').eq('plan_id', id).eq('station_id', b.station_id).in('request_id', locked).limit(1)));
    if (held.some((h) => (h.data?.length ?? 0) > 0)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }
  await auth.svc.from('logistics_stations').delete().eq('id', b.station_id).eq('plan_id', id);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
