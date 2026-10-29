import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LOCKED_MESSAGE, stationLocked, UUID, stampPlan } from '@/lib/logistics/planServer';
import { logPrize } from '@/lib/logistics/prizeServer';
import { announce, planTopic, whoIs } from '@/lib/logistics/live';
import { changedBy, noRoom, planNameOf } from '@/lib/logistics/prizeLines';

export const dynamic = 'force-dynamic';
const qty = (v: unknown) => Math.round(Number(v));
const bad = (n: number) => !Number.isFinite(n) || n < 1 || n > 100000;
const COLUMNS = 'id, station_id, prize_id, quantity, sort';
// Two people changing the same number: the later one is refused and told what it is now and who changed it, so nobody's change vanishes without a word.

// Add prizes to a station: `items` is [{ prize_id, quantity }]. A prize can be on a station once (change its number instead of adding it again); it can be on several stations, and in several events.
export async function POST(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id, sid } = await params;
  const b = { ...(await request.json().catch(() => ({}))), station_id: sid };
  if (!UUID.test(id) || !UUID.test(sid)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const items: { prize_id: string; quantity: number }[] = (Array.isArray(b.items) ? b.items : [{ prize_id: b.prize_id, quantity: b.quantity }])
    .slice(0, 200)
    .map((x: Record<string, unknown>) => ({ prize_id: String(x?.prize_id ?? ''), quantity: qty(x?.quantity) }));
  if (!items.length || items.some((x) => !UUID.test(x.prize_id) || bad(x.quantity))) return NextResponse.json({ error: 'Pick a prize and how many.' }, { status: 400 });
  const { data: station } = await auth.svc.from('logistics_stations').select('id, name').eq('id', b.station_id).eq('plan_id', id).maybeSingle();
  if (!station) return NextResponse.json({ error: 'That station is gone.' }, { status: 404 });
  if (await stationLocked(auth.svc, id, b.station_id)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const short = await noRoom(
    auth.svc,
    items.map((x) => ({ prize_id: x.prize_id, add: x.quantity })),
  );
  if (short) return NextResponse.json({ error: short }, { status: 409 });
  const { data: have } = await auth.svc.from('logistics_plan_prizes').select('id, prize_id, quantity, sort, updated_by').eq('station_id', b.station_id);
  const dupe = items.map((x) => (have ?? []).find((h) => h.prize_id === x.prize_id)).find(Boolean);
  if (dupe)
    return NextResponse.json(
      {
        code: 'exists',
        line: dupe.id,
        current: dupe.quantity,
        by: await changedBy(auth.svc, dupe.updated_by as string | null),
        error: 'That prize is already on this station (someone may have just added it). Change its number instead.',
      },
      { status: 409 },
    );
  let sort = Math.max(0, ...(have ?? []).map((h) => h.sort as number));
  const { data, error } = await auth.svc
    .from('logistics_plan_prizes')
    .insert(items.map((x) => ({ plan_id: id, station_id: b.station_id, prize_id: x.prize_id, quantity: x.quantity, sort: ++sort, updated_by: auth.user.id })))
    .select(COLUMNS);
  if (error) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  const [planName, who] = await Promise.all([planNameOf(auth.svc, id), whoIs(auth.svc, auth.user.id)]);
  await logPrize(
    auth.svc,
    items.map((x) => ({ prize_id: x.prize_id, kind: 'assign' as const, qty: x.quantity, plan_id: id, plan_name: planName, station: station.name as string, actor: auth.user.id })),
  );
  await stampPlan(auth.svc, id);
  for (const l of data ?? [])
    await announce(
      planTopic(id),
      { k: 'line', plan: id, line: l.id as string, station: l.station_id as string, prize: l.prize_id as string, qty: l.quantity as number, was: 0 },
      who,
    );
  return NextResponse.json({ lines: data }, { status: 201 });
}
