import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, touchPlan } from '@/lib/logistics/planServer';

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

// Stations: the named places in an event (Smash Table 1, Main Stage) that devices and prizes are assigned to; one station is a team's whole setup. `prize_only` marks one made only for prizes (a raffle,
// a scavenger hunt): the Devices page leaves it out until it has devices. Made per plan.
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
  const extra = { contact: text(b.contact, 200), room: text(b.room, 120), prize_only: b.prize_only === true };
  const { data, error } = await auth.svc
    .from('logistics_stations')
    .insert(names.map((n) => ({ plan_id: id, name: n, sort: ++sort, ...extra })))
    .select(COLUMNS);
  if (error) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ stations: data }, { status: 201 });
}
