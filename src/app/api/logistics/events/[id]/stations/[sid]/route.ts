import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LOCKED_MESSAGE, lockedRequestIds, stationLocked, UUID, touchPlan } from '@/lib/logistics/planServer';
import { logPrize } from '@/lib/logistics/prizeServer';

export const dynamic = 'force-dynamic';
const name = (v: unknown) =>
  String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
const COLUMNS = 'id, name, sort, contact, room, prize_only, prize_request_id, prize_target_qty, prize_target_sizes';
const text = (v: unknown, n: number) => {
  const s = String(v ?? '')
    .trim()
    .slice(0, n);
  return s || null;
};

// One station of an event: rename it or change its room and contact, or remove it (its prizes come off, and the history says so).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id, sid } = await params;
  const b = { ...(await request.json().catch(() => ({}))), station_id: sid };
  if (!UUID.test(id) || typeof b.station_id !== 'string' || !UUID.test(b.station_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if ('name' in b) {
    const n = name(b.name);
    if (!n) return NextResponse.json({ error: 'The name can’t be empty.' }, { status: 400 });
    patch.name = n;
  }
  if ('contact' in b) patch.contact = text(b.contact, 200);
  if ('room' in b) patch.room = text(b.room, 120);
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  if ('name' in patch && (await stationLocked(auth.svc, id, b.station_id))) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 }); // the name of a station whose prize request is locked stays
  const { data, error } = await auth.svc.from('logistics_stations').update(patch).eq('id', b.station_id).eq('plan_id', id).select(COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ station: data });
}

// Removing a station leaves its devices in the plan, unassigned.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id, sid } = await params;
  const b = { ...(await request.json().catch(() => ({}))), station_id: sid };
  if (!UUID.test(id) || typeof b.station_id !== 'string' || !UUID.test(b.station_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const locked = [...(await lockedRequestIds(auth.svc, id))];
  if (locked.length) {
    // removing a team would unassign the rows of a locked request
    const held = await Promise.all(
      ['logistics_plan_devices', 'logistics_plan_borrowed', 'logistics_plan_slots'].map((t) =>
        auth.svc.from(t).select('plan_id').eq('plan_id', id).eq('station_id', b.station_id).in('request_id', locked).limit(1),
      ),
    );
    if (held.some((h) => (h.data?.length ?? 0) > 0)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  }
  if (await stationLocked(auth.svc, id, b.station_id)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  // Its prize lines go with it: they are no longer promised, which the prizes' histories say.
  const [{ data: gone }, { data: pl }, { data: st }] = await Promise.all([
    auth.svc.from('logistics_plan_prizes').select('prize_id, quantity').eq('station_id', b.station_id),
    auth.svc.from('logistics_plans').select('name').eq('id', id).maybeSingle(),
    auth.svc.from('logistics_stations').select('name').eq('id', b.station_id).eq('plan_id', id).maybeSingle(),
  ]);
  await auth.svc.from('logistics_stations').delete().eq('id', b.station_id).eq('plan_id', id);
  await logPrize(
    auth.svc,
    (gone ?? []).map((g) => ({
      prize_id: g.prize_id as string,
      kind: 'assign' as const,
      qty: -(g.quantity as number),
      plan_id: id,
      plan_name: (pl?.name as string | undefined) ?? null,
      station: (st?.name as string | undefined) ?? null,
      note: 'Station removed',
      actor: auth.user.id,
    })),
  );
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
