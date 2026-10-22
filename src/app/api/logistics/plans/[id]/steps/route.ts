import { NextResponse } from 'next/server';
import { namesOf } from '@/lib/docs/docsServer';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, findItem, loadSteps, ownerLabelOf, ownerNames, slimBorrowed, slimClub, slimSlot, touchPlan } from '@/lib/logistics/planServer';
import { describeChange, type Device, type KitLine } from '@/lib/logistics/devices';
import { stepAppliesTo } from '@/lib/logistics/plans';

export const dynamic = 'force-dynamic';

// The event-day steps. Any officer can do them (that is the point of a crew on the day); everything else in Logistics needs the Logistics permission.
async function context(id: string) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return { error: auth.error };
  if (!UUID.test(id)) return { error: NextResponse.json({ error: 'Not found.' }, { status: 404 }) };
  const { data: plan } = await auth.svc.from('logistics_plans').select('id, name, status').eq('id', id).maybeSingle();
  if (!plan) return { error: NextResponse.json({ error: 'That plan is gone.' }, { status: 404 }) };
  if (plan.status === 'closed') return { error: NextResponse.json({ error: 'This plan is closed. Reopen it to record more steps.' }, { status: 409 }) };
  return { auth, plan: plan as { id: string; name: string } };
}

// Mark a step done for a device, found by the ID typed as written on it (a borrowed device of this event first, then the inventory) or by its id. A club device that isn't in the
// plan is accepted too (a spare used on the day) and reported as such. If the step reviews the kit, `kit` carries each part's present / missing and the item's missing parts are
// updated to match (nothing else about it changes).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await context(id);
  if (c.error) return c.error;
  const { auth, plan } = c;
  const svc = auth!.svc;
  const b = await request.json().catch(() => ({}));
  if (typeof b.step_id !== 'string' || !UUID.test(b.step_id)) return NextResponse.json({ error: 'Pick a step first.' }, { status: 400 });
  if (!b.tag && !b.device_id && !b.borrowed_id && !b.slot_id) return NextResponse.json({ error: 'Type the ID written on the device.' }, { status: 400 });
  const found = await findItem(svc, plan!.id, b);
  if (!found) return NextResponse.json({ error: `No device with the ID “${String(b.tag ?? '').trim()}”.` }, { status: 404 });
  const steps = await loadSteps(svc);
  const step = steps.find((s) => s.id === b.step_id);
  if (!step) return NextResponse.json({ error: 'That step is gone.' }, { status: 404 });
  const kind = found.kind === 'borrowed' ? found.row.owner_kind : 'club';
  if (!stepAppliesTo(step, kind)) return NextResponse.json({ error: `“${step.name}” isn’t for ${kind === 'club' ? 'club' : 'borrowed'} devices.` }, { status: 400 });

  const itemCol = found.kind === 'club' ? 'device_id' : found.kind === 'borrowed' ? 'borrowed_id' : 'slot_id';
  const itemId = found.kind === 'club' ? (found.device.id as string) : found.row.id;
  const placed = found.kind === 'club'
    ? (await svc.from('logistics_plan_devices').select('station_id, role').eq('plan_id', plan!.id).eq('device_id', itemId).maybeSingle()).data
    : { station_id: found.row.station_id, role: found.kind === 'borrowed' ? found.row.role : 'planned' };
  const { data: station } = placed?.station_id ? await svc.from('logistics_stations').select('id, name').eq('id', placed.station_id as string).maybeSingle() : { data: null };
  const { data: already } = await svc.from('logistics_plan_steps').select('done_at').eq('plan_id', plan!.id).eq(itemCol, itemId).eq('step_id', step.id).maybeSingle();

  let item;
  if (found.kind === 'club') {
    const device = found.device as unknown as Device;
    item = slimClub(device);
    if (step.kit && Array.isArray(b.kit)) {
      const flags = new Map((b.kit as { item?: unknown; missing?: unknown }[]).map((k) => [String(k.item ?? '').toLowerCase(), k.missing === true]));
      const kit: KitLine[] = device.kit.map((k) => (flags.has(k.item.toLowerCase()) ? { ...k, missing: flags.get(k.item.toLowerCase())! } : k));
      const lines = describeChange(device, { ...device, kit });
      if (lines.length) {
        await svc.from('logistics_devices').update({ kit, updated_at: new Date().toISOString() }).eq('id', device.id);
        await svc.from('logistics_device_log').insert(lines.map((l) => ({ device_id: device.id, actor_id: auth!.user.id, kind: l.kind, summary: `${l.summary} (${step.name}, ${plan!.name})` })));
        item = slimClub({ ...device, kit });
      }
    }
  } else if (found.kind === 'slot') {
    item = slimSlot(found.row);
  } else {
    let row = found.row;
    if (step.kit && Array.isArray(b.kit)) {
      const flags = new Map((b.kit as { item?: unknown; missing?: unknown }[]).map((k) => [String(k.item ?? '').toLowerCase(), k.missing === true]));
      const kit = row.kit.map((k) => (flags.has(k.item.toLowerCase()) ? { ...k, missing: flags.get(k.item.toLowerCase())! } : k));
      if (JSON.stringify(kit) !== JSON.stringify(row.kit)) { await svc.from('logistics_plan_borrowed').update({ kit }).eq('id', row.id); row = { ...row, kit }; }
    }
    item = slimBorrowed(row, ownerLabelOf(row, await ownerNames(svc, [row])));
  }
  let done_at = already?.done_at as string | undefined;
  if (!already) {
    const ins = await svc.from('logistics_plan_steps').insert({ plan_id: plan!.id, [itemCol]: itemId, step_id: step.id, done_by: auth!.user.id }).select('done_at').single();
    if (ins.error) return NextResponse.json({ error: 'Couldn’t save that step.' }, { status: 500 });
    done_at = ins.data.done_at as string;
  }
  return NextResponse.json({ item, inPlan: found.kind !== 'club' || !!placed, role: placed?.role ?? null, station: station ?? null, already: !!already, done_at, step_id: step.id, by: already ? null : (await namesOf(svc, [auth!.user.id])).get(auth!.user.id) ?? null });
}

// Undo a step (a mistyped ID, a wrong tap). Any officer can; a club device's history records it.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await context(id);
  if (c.error) return c.error;
  const { auth, plan } = c;
  const b = await request.json().catch(() => ({}));
  const col = typeof b.slot_id === 'string' && UUID.test(b.slot_id) ? 'slot_id' : typeof b.borrowed_id === 'string' && UUID.test(b.borrowed_id) ? 'borrowed_id' : typeof b.device_id === 'string' && UUID.test(b.device_id) ? 'device_id' : null;
  if (!col || typeof b.step_id !== 'string' || !UUID.test(b.step_id)) return NextResponse.json({ error: 'Nothing to undo.' }, { status: 400 });
  const itemId = b[col] as string;
  const { data: gone } = await auth!.svc.from('logistics_plan_steps').delete().eq('plan_id', plan!.id).eq(col, itemId).eq('step_id', b.step_id).select('step_id');
  if (gone?.length) {
    if (col === 'device_id') {
      const { data: step } = await auth!.svc.from('logistics_options').select('value').eq('id', b.step_id).maybeSingle();
      await auth!.svc.from('logistics_device_log').insert({ device_id: itemId, actor_id: auth!.user.id, kind: 'step', summary: `Undid “${step?.value ?? 'a step'}” at ${plan!.name}` });
    }
    await touchPlan(auth!.svc, plan!.id);
  }
  return NextResponse.json({ ok: true });
}
