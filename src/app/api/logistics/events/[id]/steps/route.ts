import { NextResponse } from 'next/server';
import { namesOf } from '@/lib/docs/docsServer';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, findItem, loadSteps, ownerLabelOf, ownerNames, slimBorrowed, slimClub, slimSlot, touchPlan } from '@/lib/logistics/planServer';
import { describeChange, type Device, type KitLine } from '@/lib/logistics/devices';
import { stepAppliesTo } from '@/lib/logistics/plans';

export const dynamic = 'force-dynamic';

// The name shown beside a tick is the signed-in officer's own, and it hardly ever changes: it is remembered for ten minutes so a busy event day doesn't read it again for every tick.
const nameCache = new Map<string, { name: string | null; at: number }>();
async function myName(svc: Parameters<typeof namesOf>[0], id: string): Promise<string | null> {
  const hit = nameCache.get(id);
  if (hit && Date.now() - hit.at < 600_000) return hit.name;
  const name = (await namesOf(svc, [id])).get(id) ?? null;
  nameCache.set(id, { name, at: Date.now() });
  return name;
}

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
  if (Array.isArray(b.items)) return markMany(svc, auth!.user.id, plan!.id, b.step_id, b.items);
  if (!b.tag && !b.device_id && !b.borrowed_id && !b.slot_id) return NextResponse.json({ error: 'Type the ID written on the device.' }, { status: 400 });
  const [found, steps] = await Promise.all([findItem(svc, plan!.id, b), loadSteps(svc)]); // the two reads don't depend on each other
  if (!found) return NextResponse.json({ error: `No device with the ID “${String(b.tag ?? '').trim()}”.` }, { status: 404 });
  const step = steps.find((s) => s.id === b.step_id);
  if (!step) return NextResponse.json({ error: 'That step is gone.' }, { status: 404 });
  const kind = found.kind === 'borrowed' ? found.row.owner_kind : 'club';
  if (!stepAppliesTo(step, kind)) return NextResponse.json({ error: `“${step.name}” isn’t for ${kind === 'club' ? 'club' : 'borrowed'} devices.` }, { status: 400 });

  const itemCol = found.kind === 'club' ? 'device_id' : found.kind === 'borrowed' ? 'borrowed_id' : 'slot_id';
  const itemId = found.kind === 'club' ? (found.device.id as string) : found.row.id;
  const [placed, { data: already }] = await Promise.all([
    found.kind === 'club'
      ? svc
          .from('logistics_plan_devices')
          .select('station_id, role')
          .eq('plan_id', plan!.id)
          .eq('device_id', itemId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve({ station_id: found.row.station_id, role: found.kind === 'borrowed' ? found.row.role : 'planned' }),
    svc.from('logistics_plan_steps').select('done_at').eq('plan_id', plan!.id).eq(itemCol, itemId).eq('step_id', step.id).maybeSingle(),
  ]);
  const { data: station } = placed?.station_id
    ? await svc
        .from('logistics_stations')
        .select('id, name')
        .eq('id', placed.station_id as string)
        .maybeSingle()
    : { data: null };

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
        await svc
          .from('logistics_device_log')
          .insert(lines.map((l) => ({ device_id: device.id, actor_id: auth!.user.id, kind: l.kind, summary: `${l.summary} (${step.name}, ${plan!.name})` })));
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
      if (JSON.stringify(kit) !== JSON.stringify(row.kit)) {
        await svc.from('logistics_plan_borrowed').update({ kit }).eq('id', row.id);
        row = { ...row, kit };
      }
    }
    item = slimBorrowed(row, ownerLabelOf(row, await ownerNames(svc, [row])));
  }
  let done_at = already?.done_at as string | undefined;
  if (!already) {
    const ins = await svc
      .from('logistics_plan_steps')
      .insert({ plan_id: plan!.id, [itemCol]: itemId, step_id: step.id, done_by: auth!.user.id })
      .select('done_at')
      .single();
    if (ins.error) return NextResponse.json({ error: 'Couldn’t save that step.' }, { status: 500 });
    done_at = ins.data.done_at as string;
  }
  return NextResponse.json({
    item,
    inPlan: found.kind !== 'club' || !!placed,
    role: placed?.role ?? null,
    station: station ?? null,
    already: !!already,
    done_at,
    step_id: step.id,
    by: already ? null : await myName(svc, auth!.user.id),
  });
}

// "Mark all" for a team: the same step for many devices in one go (by their ids; steps that review the parts are marked one device at a time). One read of the step list, four reads of
// what the ids are and what is already done, and one insert, instead of about eight reads and a write for every device.
async function markMany(svc: Parameters<typeof touchPlan>[0], userId: string, planId: string, stepId: string, raw: unknown[]) {
  const steps = await loadSteps(svc);
  const step = steps.find((s) => s.id === stepId);
  if (!step) return NextResponse.json({ error: 'That step is gone.' }, { status: 404 });
  if (step.kit) return NextResponse.json({ error: `“${step.name}” reviews the parts, so it is marked one device at a time.` }, { status: 400 });
  const want = { device_id: [] as string[], borrowed_id: [] as string[], slot_id: [] as string[] };
  for (const x of raw.slice(0, 300) as Record<string, unknown>[])
    for (const col of ['device_id', 'borrowed_id', 'slot_id'] as const) if (typeof x?.[col] === 'string' && UUID.test(x[col] as string)) want[col].push(x[col] as string);
  const none = Promise.resolve({ data: [] as Record<string, unknown>[] });
  const [dev, bor, slo, done] = await Promise.all([
    want.device_id.length ? svc.from('logistics_plan_devices').select('device_id').eq('plan_id', planId).in('device_id', want.device_id) : none,
    want.borrowed_id.length ? svc.from('logistics_plan_borrowed').select('id, owner_kind').eq('plan_id', planId).in('id', want.borrowed_id) : none,
    want.slot_id.length ? svc.from('logistics_plan_slots').select('id').eq('plan_id', planId).in('id', want.slot_id) : none,
    svc.from('logistics_plan_steps').select('device_id, borrowed_id, slot_id').eq('plan_id', planId).eq('step_id', step.id),
  ]);
  const has = new Set((done.data ?? []).map((d) => `${d.device_id ?? d.borrowed_id ?? d.slot_id}`));
  const rows: Record<string, unknown>[] = [];
  for (const d of dev.data ?? [])
    if (stepAppliesTo(step, 'club') && !has.has(d.device_id as string)) rows.push({ plan_id: planId, device_id: d.device_id, step_id: step.id, done_by: userId });
  for (const b of bor.data ?? [])
    if (stepAppliesTo(step, b.owner_kind as 'sponsor' | 'officer') && !has.has(b.id as string))
      rows.push({ plan_id: planId, borrowed_id: b.id, step_id: step.id, done_by: userId });
  for (const s of slo.data ?? []) if (stepAppliesTo(step, 'club') && !has.has(s.id as string)) rows.push({ plan_id: planId, slot_id: s.id, step_id: step.id, done_by: userId });
  if (!rows.length) return NextResponse.json({ rows: [], by: null });
  const ins = await svc.from('logistics_plan_steps').insert(rows).select('device_id, borrowed_id, slot_id, step_id, done_at');
  if (ins.error) return NextResponse.json({ error: 'Couldn’t save those steps.' }, { status: 500 });
  return NextResponse.json({ rows: ins.data ?? [], by: await myName(svc, userId) });
}

// Undo a step (a mistyped ID, a wrong tap). Any officer can; a club device's history records it.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await context(id);
  if (c.error) return c.error;
  const { auth, plan } = c;
  const b = await request.json().catch(() => ({}));
  const col =
    typeof b.slot_id === 'string' && UUID.test(b.slot_id)
      ? 'slot_id'
      : typeof b.borrowed_id === 'string' && UUID.test(b.borrowed_id)
        ? 'borrowed_id'
        : typeof b.device_id === 'string' && UUID.test(b.device_id)
          ? 'device_id'
          : null;
  if (!col || typeof b.step_id !== 'string' || !UUID.test(b.step_id)) return NextResponse.json({ error: 'Nothing to undo.' }, { status: 400 });
  const itemId = b[col] as string;
  const { data: gone } = await auth!.svc.from('logistics_plan_steps').delete().eq('plan_id', plan!.id).eq(col, itemId).eq('step_id', b.step_id).select('step_id');
  if (gone?.length) {
    if (col === 'device_id') {
      const { data: step } = await auth!.svc.from('logistics_options').select('value').eq('id', b.step_id).maybeSingle();
      await auth!.svc
        .from('logistics_device_log')
        .insert({ device_id: itemId, actor_id: auth!.user.id, kind: 'step', summary: `Undid “${step?.value ?? 'a step'}” at ${plan!.name}` });
    }
    await touchPlan(auth!.svc, plan!.id);
  }
  return NextResponse.json({ ok: true });
}
