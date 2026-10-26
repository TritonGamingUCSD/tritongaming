import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LOCKED_MESSAGE, stationLocked, UUID, stampPlan } from '@/lib/logistics/planServer';
import { loadPrizeTotals, logPrize } from '@/lib/logistics/prizeServer';
import { announce, planTopic, whoIs } from '@/lib/logistics/live';
import { prizeLeft } from '@/lib/logistics/prizes';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const qty = (v: unknown) => Math.round(Number(v));
const bad = (n: number) => !Number.isFinite(n) || n < 1 || n > 100000;
const COLUMNS = 'id, station_id, prize_id, quantity, sort';
const planNameOf = async (svc: SupabaseClient, id: string) => ((await svc.from('logistics_plans').select('name').eq('id', id).maybeSingle()).data?.name as string | undefined) ?? null;
const stationNameOf = async (svc: SupabaseClient, id: string) => ((await svc.from('logistics_stations').select('name').eq('id', id).maybeSingle()).data?.name as string | undefined) ?? null;

// Two people changing the same number: the later one is refused and told what it is now and who changed it, so nobody's change vanishes without a word.
async function changedBy(svc: SupabaseClient, userId: string | null | undefined): Promise<string> {
  return userId ? (await whoIs(svc, userId)).name : 'Someone';
}
const clash = (current: number, by: string, was: number) => NextResponse.json({ code: 'changed', current, by, error: `${by} just changed this from ${was} to ${current}.` }, { status: 409 });

// Never promise more than there is: each prize's `add` (how many more a station is asking for) can't be above what is left of it (on hand, minus what open events hold).
// Lowering a station's number is always allowed, so a prize that ended up over-promised (its stock was changed afterwards) can be fixed by lowering a station.
async function noRoom(svc: SupabaseClient, wants: { prize_id: string; add: number }[]): Promise<string | null> {
  const need = new Map<string, number>();
  for (const w of wants) need.set(w.prize_id, (need.get(w.prize_id) ?? 0) + w.add);
  const ids = [...need].filter(([, n]) => n > 0).map(([id]) => id);
  if (!ids.length) return null;
  const [{ data: prizes }, totals] = await Promise.all([svc.from('logistics_prizes').select('id, name, quantity').in('id', ids), loadPrizeTotals(svc, ids)]);
  for (const p of prizes ?? []) {
    const left = prizeLeft(p as { quantity: number }, totals.get(p.id as string) ?? { allocated: 0 });
    if ((need.get(p.id as string) ?? 0) > left) return `Only ${Math.max(0, left)} left of ${p.name}. That is not enough for ${need.get(p.id as string)} more.`;
  }
  return null;
}

// What a station gets: this many of this prize. A prize can be on a station once (change its number instead of adding it again); it can be on several stations, and in several events.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.station_id !== 'string' || !UUID.test(b.station_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const items: { prize_id: string; quantity: number }[] = (Array.isArray(b.items) ? b.items : [{ prize_id: b.prize_id, quantity: b.quantity }]).slice(0, 200).map((x: Record<string, unknown>) => ({ prize_id: String(x?.prize_id ?? ''), quantity: qty(x?.quantity) }));
  if (!items.length || items.some((x) => !UUID.test(x.prize_id) || bad(x.quantity))) return NextResponse.json({ error: 'Pick a prize and how many.' }, { status: 400 });
  const { data: station } = await auth.svc.from('logistics_stations').select('id, name').eq('id', b.station_id).eq('plan_id', id).maybeSingle();
  if (!station) return NextResponse.json({ error: 'That station is gone.' }, { status: 404 });
  if (await stationLocked(auth.svc, id, b.station_id)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const short = await noRoom(auth.svc, items.map((x) => ({ prize_id: x.prize_id, add: x.quantity })));
  if (short) return NextResponse.json({ error: short }, { status: 409 });
  const { data: have } = await auth.svc.from('logistics_plan_prizes').select('id, prize_id, quantity, sort, updated_by').eq('station_id', b.station_id);
  const dupe = items.map((x) => (have ?? []).find((h) => h.prize_id === x.prize_id)).find(Boolean);
  if (dupe) return NextResponse.json({ code: 'exists', line: dupe.id, current: dupe.quantity, by: await changedBy(auth.svc, dupe.updated_by as string | null), error: 'That prize is already on this station (someone may have just added it). Change its number instead.' }, { status: 409 });
  let sort = Math.max(0, ...(have ?? []).map((h) => h.sort as number));
  const { data, error } = await auth.svc.from('logistics_plan_prizes').insert(items.map((x) => ({ plan_id: id, station_id: b.station_id, prize_id: x.prize_id, quantity: x.quantity, sort: ++sort, updated_by: auth.user.id }))).select(COLUMNS);
  if (error) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  const [planName, who] = await Promise.all([planNameOf(auth.svc, id), whoIs(auth.svc, auth.user.id)]);
  await logPrize(auth.svc, items.map((x) => ({ prize_id: x.prize_id, kind: 'assign' as const, qty: x.quantity, plan_id: id, plan_name: planName, station: station.name as string, actor: auth.user.id })));
  await stampPlan(auth.svc, id);
  for (const l of data ?? []) await announce(planTopic(id), { k: 'line', plan: id, line: l.id as string, station: l.station_id as string, prize: l.prize_id as string, qty: l.quantity as number, was: 0 }, who);
  return NextResponse.json({ lines: data }, { status: 201 });
}

// Changes a number. `expected` is the number the person was looking at: if it is not what it is now, someone else got there first and nothing is changed.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.line_id !== 'string' || !UUID.test(b.line_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const n = qty(b.quantity);
  if (bad(n)) return NextResponse.json({ error: 'How many has to be a whole number, 1 or more.' }, { status: 400 });
  const { data: line } = await auth.svc.from('logistics_plan_prizes').select('prize_id, quantity, station_id, updated_by').eq('id', b.line_id).eq('plan_id', id).maybeSingle();
  if (!line) return NextResponse.json({ code: 'gone', error: 'Someone took that off this station.' }, { status: 404 });
  if (await stationLocked(auth.svc, id, line.station_id as string)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const was = line.quantity as number;
  if (b.expected !== undefined && Math.round(Number(b.expected)) !== was) return clash(was, await changedBy(auth.svc, line.updated_by as string | null), Math.round(Number(b.expected)));
  const short = await noRoom(auth.svc, [{ prize_id: line.prize_id as string, add: n - was }]);
  if (short) return NextResponse.json({ error: short }, { status: 409 });
  // The change only goes in if the number is still the one just read, so two saves at once cannot both succeed.
  const { data, error } = await auth.svc.from('logistics_plan_prizes').update({ quantity: n, updated_by: auth.user.id, updated_at: new Date().toISOString() }).eq('id', b.line_id).eq('plan_id', id).eq('quantity', was).select(COLUMNS).maybeSingle();
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (!data) { const { data: now } = await auth.svc.from('logistics_plan_prizes').select('quantity, updated_by').eq('id', b.line_id).maybeSingle(); return clash((now?.quantity as number | undefined) ?? 0, await changedBy(auth.svc, now?.updated_by as string | null), was); }
  // A count can't be above how many there are now.
  const { data: steps } = await auth.svc.from('logistics_plan_prize_steps').select('step_id, done').eq('line_id', b.line_id).gt('done', n);
  for (const s of steps ?? []) await auth.svc.from('logistics_plan_prize_steps').update({ done: n }).eq('line_id', b.line_id).eq('step_id', s.step_id as string);
  await stampPlan(auth.svc, id);
  const [planName, stationName, who] = await Promise.all([planNameOf(auth.svc, id), stationNameOf(auth.svc, line.station_id as string), whoIs(auth.svc, auth.user.id)]);
  if (n !== was) await logPrize(auth.svc, [{ prize_id: line.prize_id as string, kind: 'assign', qty: n - was, plan_id: id, plan_name: planName, station: stationName, actor: auth.user.id }]);
  await announce(planTopic(id), { k: 'line', plan: id, line: b.line_id, station: line.station_id as string, prize: line.prize_id as string, qty: n, was }, who);
  return NextResponse.json({ line: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.line_id !== 'string' || !UUID.test(b.line_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: gone } = await auth.svc.from('logistics_plan_prizes').select('station_id, prize_id, quantity, updated_by').eq('id', b.line_id).eq('plan_id', id).maybeSingle();
  if (!gone) return NextResponse.json({ ok: true });   // already off the station
  if (await stationLocked(auth.svc, id, gone.station_id as string)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  if (b.expected !== undefined && Math.round(Number(b.expected)) !== (gone.quantity as number)) return clash(gone.quantity as number, await changedBy(auth.svc, gone.updated_by as string | null), Math.round(Number(b.expected)));
  await auth.svc.from('logistics_plan_prizes').delete().eq('id', b.line_id).eq('plan_id', id);
  const [planName, stationName, who] = await Promise.all([planNameOf(auth.svc, id), stationNameOf(auth.svc, gone.station_id as string), whoIs(auth.svc, auth.user.id)]);
  await logPrize(auth.svc, [{ prize_id: gone.prize_id as string, kind: 'assign', qty: -(gone.quantity as number), plan_id: id, plan_name: planName, station: stationName, actor: auth.user.id }]);
  await stampPlan(auth.svc, id);
  await announce(planTopic(id), { k: 'line', plan: id, line: b.line_id, station: gone.station_id as string, prize: gone.prize_id as string, qty: 0, was: gone.quantity as number }, who);
  return NextResponse.json({ ok: true });
}
