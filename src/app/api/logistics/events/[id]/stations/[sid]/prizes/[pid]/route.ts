import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LOCKED_MESSAGE, stationLocked, UUID, stampPlan } from '@/lib/logistics/planServer';
import { logPrize } from '@/lib/logistics/prizeServer';
import { announce, planTopic, whoIs } from '@/lib/logistics/live';
import { changedBy, noRoom, planNameOf, stationNameOf } from '@/lib/logistics/prizeLines';

export const dynamic = 'force-dynamic';
const qty = (v: unknown) => Math.round(Number(v));
const bad = (n: number) => !Number.isFinite(n) || n < 1 || n > 100000;
const COLUMNS = 'id, station_id, prize_id, quantity, sort';
// Two people changing the same number: the later one is refused and told what it is now and who changed it, so nobody's change vanishes without a word.
const clash = (current: number, by: string, was: number) =>
  NextResponse.json({ code: 'changed', current, by, error: `${by} just changed this from ${was} to ${current}.` }, { status: 409 });

// One prize on one station: change its number (PATCH, with `expected`) or take it off (DELETE).
// Changes a number. `expected` is the number the person was looking at: if it is not what it is now, someone else got there first and nothing is changed.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sid: string; pid: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id, sid, pid } = await params;
  const b = { ...(await request.json().catch(() => ({}))) } as Record<string, unknown>;
  if (!UUID.test(id) || !UUID.test(sid) || !UUID.test(pid)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const n = qty(b.quantity);
  if (bad(n)) return NextResponse.json({ error: 'How many has to be a whole number, 1 or more.' }, { status: 400 });
  const { data: line } = await auth.svc
    .from('logistics_plan_prizes')
    .select('id, prize_id, quantity, station_id, updated_by')
    .eq('station_id', sid)
    .eq('prize_id', pid)
    .eq('plan_id', id)
    .maybeSingle();
  if (!line) return NextResponse.json({ code: 'gone', error: 'Someone took that off this station.' }, { status: 404 });
  if (await stationLocked(auth.svc, id, line.station_id as string)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const was = line.quantity as number;
  if (b.expected !== undefined && Math.round(Number(b.expected)) !== was)
    return clash(was, await changedBy(auth.svc, line.updated_by as string | null), Math.round(Number(b.expected)));
  const short = await noRoom(auth.svc, [{ prize_id: line.prize_id as string, add: n - was }]);
  if (short) return NextResponse.json({ error: short }, { status: 409 });
  // The change only goes in if the number is still the one just read, so two saves at once cannot both succeed.
  const { data, error } = await auth.svc
    .from('logistics_plan_prizes')
    .update({ quantity: n, updated_by: auth.user.id, updated_at: new Date().toISOString() })
    .eq('id', line.id as string)
    .eq('plan_id', id)
    .eq('quantity', was)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (!data) {
    const { data: now } = await auth.svc
      .from('logistics_plan_prizes')
      .select('quantity, updated_by')
      .eq('id', line.id as string)
      .maybeSingle();
    return clash((now?.quantity as number | undefined) ?? 0, await changedBy(auth.svc, now?.updated_by as string | null), was);
  }
  // A count can't be above how many there are now.
  const { data: steps } = await auth.svc
    .from('logistics_plan_prize_steps')
    .select('step_id, done')
    .eq('line_id', line.id as string)
    .gt('done', n);
  for (const s of steps ?? [])
    await auth.svc
      .from('logistics_plan_prize_steps')
      .update({ done: n })
      .eq('line_id', line.id as string)
      .eq('step_id', s.step_id as string);
  await stampPlan(auth.svc, id);
  const [planName, stationName, who] = await Promise.all([planNameOf(auth.svc, id), stationNameOf(auth.svc, line.station_id as string), whoIs(auth.svc, auth.user.id)]);
  if (n !== was)
    await logPrize(auth.svc, [{ prize_id: line.prize_id as string, kind: 'assign', qty: n - was, plan_id: id, plan_name: planName, station: stationName, actor: auth.user.id }]);
  await announce(planTopic(id), { k: 'line', plan: id, line: line.id as string, station: line.station_id as string, prize: line.prize_id as string, qty: n, was }, who);
  return NextResponse.json({ line: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; sid: string; pid: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id, sid, pid } = await params;
  const b = { ...(await request.json().catch(() => ({}))) } as Record<string, unknown>;
  if (!UUID.test(id) || !UUID.test(sid) || !UUID.test(pid)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: gone } = await auth.svc
    .from('logistics_plan_prizes')
    .select('id, station_id, prize_id, quantity, updated_by')
    .eq('station_id', sid)
    .eq('prize_id', pid)
    .eq('plan_id', id)
    .maybeSingle();
  if (!gone) return NextResponse.json({ ok: true }); // already off the station
  if (await stationLocked(auth.svc, id, gone.station_id as string)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  if (b.expected !== undefined && Math.round(Number(b.expected)) !== (gone.quantity as number))
    return clash(gone.quantity as number, await changedBy(auth.svc, gone.updated_by as string | null), Math.round(Number(b.expected)));
  await auth.svc
    .from('logistics_plan_prizes')
    .delete()
    .eq('id', gone.id as string)
    .eq('plan_id', id);
  const [planName, stationName, who] = await Promise.all([planNameOf(auth.svc, id), stationNameOf(auth.svc, gone.station_id as string), whoIs(auth.svc, auth.user.id)]);
  await logPrize(auth.svc, [
    { prize_id: gone.prize_id as string, kind: 'assign', qty: -(gone.quantity as number), plan_id: id, plan_name: planName, station: stationName, actor: auth.user.id },
  ]);
  await stampPlan(auth.svc, id);
  await announce(
    planTopic(id),
    { k: 'line', plan: id, line: gone.id as string, station: gone.station_id as string, prize: gone.prize_id as string, qty: 0, was: gone.quantity as number },
    who,
  );
  return NextResponse.json({ ok: true });
}
