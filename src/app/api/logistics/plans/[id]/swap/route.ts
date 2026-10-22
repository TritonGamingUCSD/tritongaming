import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, findItem, ownerLabelOf, ownerNames, slimBorrowed, slimClub, touchPlan } from '@/lib/logistics/planServer';
import { type Device } from '@/lib/logistics/devices';
import { isUsable } from '@/lib/logistics/plans';

export const dynamic = 'force-dynamic';

// Swap a device out of a plan for another (either can be a club device or a borrowed one of this event). Any officer can (it happens on the day); the reason is required. The one
// taken out stays on the plan as a backup, marked as swapped out, and the replacement takes its station. The answer carries the replacement's details so the screen can show where
// to get it right away.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const svc = auth.svc;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const reason = String(b.reason ?? '').trim().slice(0, 300);
  if (!reason) return NextResponse.json({ error: 'Say why it is being swapped.' }, { status: 400 });
  const { data: plan } = await svc.from('logistics_plans').select('id, name, status').eq('id', id).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'That plan is gone.' }, { status: 404 });
  if (plan.status === 'closed') return NextResponse.json({ error: 'This plan is closed.' }, { status: 409 });

  const out = await findItem(svc, id, { device_id: b.device_id, borrowed_id: b.borrowed_id });
  if (!out) return NextResponse.json({ error: 'Pick the device to swap out.' }, { status: 400 });
  if (out.kind === 'slot') return NextResponse.json({ error: 'That row has no device yet. Give it one instead of swapping.' }, { status: 400 });
  const outRow = out.kind === 'club'
    ? (await svc.from('logistics_plan_devices').select('station_id, role, set_id, sort').eq('plan_id', id).eq('device_id', out.device.id as string).maybeSingle()).data
    : { station_id: out.row.station_id, role: out.row.role, set_id: out.row.set_id ?? null, sort: out.row.sort };
  if (!outRow) return NextResponse.json({ error: 'That device isn’t in the plan.' }, { status: 404 });
  const outLabel = out.kind === 'club' ? ((out.device.tag as string | null) ?? (out.device.type as string)) : out.row.tag;
  const outId = out.kind === 'club' ? (out.device.id as string) : out.row.id;

  const rep = await findItem(svc, id, { tag: b.replacement_tag, device_id: b.replacement_id, borrowed_id: b.replacement_borrowed_id });
  if (!rep) return NextResponse.json({ error: `No device with the ID “${String(b.replacement_tag ?? '').trim()}”.` }, { status: 404 });
  if (rep.kind === 'slot') return NextResponse.json({ error: 'Type the ID of a device.' }, { status: 400 });
  const repId = rep.kind === 'club' ? (rep.device.id as string) : rep.row.id;
  const repLabel = rep.kind === 'club' ? ((rep.device.tag as string | null) ?? (rep.device.type as string)) : rep.row.tag;
  if (repId === outId) return NextResponse.json({ error: 'That is the same device.' }, { status: 400 });
  if (rep.kind === 'club' && !isUsable(rep.device as unknown as Device)) return NextResponse.json({ error: `${repLabel} is marked ${String(rep.device.condition).replace('_', ' ')}, so it can’t go out.` }, { status: 400 });
  const repThere = rep.kind === 'club' ? (await svc.from('logistics_plan_devices').select('role').eq('plan_id', id).eq('device_id', repId).maybeSingle()).data : { role: rep.row.role };
  if (repThere?.role === 'planned') return NextResponse.json({ error: `${repLabel} is already in the plan.` }, { status: 409 });

  const swapped = { role: 'backup', swap_reason: reason, swapped_for_label: repLabel, station_id: null, set_id: null };
  const e1 = out.kind === 'club'
    ? (await svc.from('logistics_plan_devices').update(swapped).eq('plan_id', id).eq('device_id', outId)).error
    : (await svc.from('logistics_plan_borrowed').update(swapped).eq('id', outId)).error;
  const taking = { role: 'planned', swap_reason: null, swapped_for_label: null, station_id: outRow.station_id, set_id: outRow.set_id ?? null, sort: outRow.sort };
  const e2 = rep.kind === 'club'
    ? (await svc.from('logistics_plan_devices').upsert({ plan_id: id, device_id: repId, added_by: auth.user.id, ...taking }, { onConflict: 'plan_id,device_id' })).error
    : (await svc.from('logistics_plan_borrowed').update(taking).eq('id', repId)).error;
  if (e1 || e2) return NextResponse.json({ error: 'Couldn’t swap them.' }, { status: 500 });
  const lines = [
    ...(out.kind === 'club' ? [{ device_id: outId, actor_id: auth.user.id, kind: 'swap', summary: `Swapped out of ${plan.name} for ${repLabel}: ${reason}` }] : []),
    ...(rep.kind === 'club' ? [{ device_id: repId, actor_id: auth.user.id, kind: 'swap', summary: `Swapped in at ${plan.name} for ${outLabel}: ${reason}` }] : []),
  ];
  if (lines.length) await svc.from('logistics_device_log').insert(lines);
  await touchPlan(svc, id);
  const { data: station } = outRow.station_id ? await svc.from('logistics_stations').select('id, name').eq('id', outRow.station_id as string).maybeSingle() : { data: null };
  const replacement = rep.kind === 'club' ? slimClub(rep.device as unknown as Parameters<typeof slimClub>[0]) : slimBorrowed(rep.row, ownerLabelOf(rep.row, await ownerNames(svc, [rep.row])));
  return NextResponse.json({ replacement, station: station ?? null, swapped_out: outId });
}
