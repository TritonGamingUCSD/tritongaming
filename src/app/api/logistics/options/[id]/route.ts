import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { type OptionKind } from '@/lib/logistics/constants';
import { followBundle, requestsUsingBundle } from '@/lib/logistics/requestRows';
import { forgetLoose } from '@/lib/logistics/prizeServer';
import { APPLIES, cleanItems, cleanValue, devicesUsing, followPrizeSize } from '@/lib/logistics/optionsServer';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

// One entry of an editable list: rename or move it (PATCH) or remove it (DELETE).
// Rename a value (devices that use it follow the new name) or switch a device type between individual and counted.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = { ...(await request.json().catch(() => ({}))), id };
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: o } = await auth.svc.from('logistics_options').select('id, kind, value, meta').eq('id', b.id).maybeSingle();
  if (!o) return NextResponse.json({ error: 'That entry is gone.' }, { status: 404 });
  const kind = o.kind as OptionKind;
  const patch: Record<string, unknown> = {};
  if ((typeof b.counted === 'boolean' || typeof b.main === 'boolean') && kind === 'type')
    patch.meta = { ...(o.meta as object), ...(typeof b.counted === 'boolean' ? { counted: b.counted } : {}), ...(typeof b.main === 'boolean' ? { main: b.main } : {}) };
  if (kind === 'prize_size' && typeof b.loose === 'boolean') {
    patch.meta = { ...(o.meta as object), loose: b.loose };
    forgetLoose();
  }
  if (kind === 'step' && (typeof b.applies === 'string' || typeof b.kit === 'boolean')) {
    if (typeof b.applies === 'string' && !APPLIES.includes(b.applies)) return NextResponse.json({ error: 'Pick which devices the step is for.' }, { status: 400 });
    patch.meta = { ...(o.meta as object), ...(typeof b.applies === 'string' ? { applies: b.applies } : {}), ...(typeof b.kit === 'boolean' ? { kit: b.kit } : {}) };
  }
  if (kind === 'prize_step' && (typeof b.gives === 'boolean' || typeof b.leftover === 'boolean'))
    patch.meta = { ...(o.meta as object), ...(typeof b.gives === 'boolean' ? { gives: b.gives } : {}), ...(typeof b.leftover === 'boolean' ? { leftover: b.leftover } : {}) };
  if (kind === 'bundle' && 'items' in b) {
    const r = await cleanItems(auth.svc, b.items);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    patch.meta = { ...(o.meta as object), items: r.items };
  }
  if ((kind === 'step' || kind === 'prize_step') && (b.move === 'up' || b.move === 'down')) {
    // Swap places with the neighbouring step.
    const { data: all } = await auth.svc.from('logistics_options').select('id, sort').eq('kind', kind).order('sort').order('value');
    const list = all ?? [];
    const i = list.findIndex((x) => x.id === o.id);
    const j = b.move === 'up' ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < list.length) {
      const renumbered = list.map((x, k) => ({ id: x.id as string, sort: k + 1 }));
      [renumbered[i].sort, renumbered[j].sort] = [renumbered[j].sort, renumbered[i].sort];
      for (const r of renumbered) await auth.svc.from('logistics_options').update({ sort: r.sort }).eq('id', r.id);
    }
    return NextResponse.json({ ok: true });
  }
  if (typeof b.value === 'string') {
    const value = cleanValue(b.value);
    if (!value) return NextResponse.json({ error: 'The name can’t be empty.' }, { status: 400 });
    if (value !== o.value) {
      const { data: dup } = await auth.svc
        .from('logistics_options')
        .select('id')
        .eq('kind', kind)
        .ilike(
          'value',
          value.replace(/[%_]/g, (c) => `\\${c}`),
        )
        .neq('id', o.id as string)
        .maybeSingle();
      if (dup) return NextResponse.json({ error: `${value} is already in the list.` }, { status: 409 });
      patch.value = value;
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
  const { error } = await auth.svc
    .from('logistics_options')
    .update(patch)
    .eq('id', o.id as string);
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (kind === 'bundle' && (patch.meta || typeof patch.value === 'string'))
    await followBundle(auth.svc, o.value as string, typeof patch.value === 'string' ? patch.value : (o.value as string));
  // Devices use the value as text, so a rename is followed here.
  if (typeof patch.value === 'string') {
    const old = o.value as string,
      now = patch.value;
    if (kind === 'prize_step') {
      /* nothing to follow: steps are kept by id */
    } else if (kind === 'prize_size') await followPrizeSize(auth.svc, old, now);
    else if (kind === 'type' || kind === 'shelf' || kind === 'tier')
      await auth.svc
        .from('logistics_devices')
        .update({ [kind]: now })
        .eq(kind, old);
    else {
      const rows = (await devicesUsing(auth.svc, kind, old)) as unknown as { id: string; ports: string[]; games: string[]; kit: { item: string }[] }[];
      for (const r of rows) {
        const upd =
          kind === 'port'
            ? { ports: r.ports.map((x) => (x === old ? now : x)) }
            : kind === 'game'
              ? { games: r.games.map((x) => (x === old ? now : x)) }
              : { kit: r.kit.map((k) => (k.item === old ? { ...k, item: now } : k)) };
        await auth.svc.from('logistics_devices').update(upd).eq('id', r.id);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = { ...(await request.json().catch(() => ({}))), id };
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: o } = await auth.svc.from('logistics_options').select('id, kind, value').eq('id', b.id).maybeSingle();
  if (!o) return NextResponse.json({ ok: true });
  if (o.kind === 'bundle') {
    const n = await requestsUsingBundle(auth.svc, o.value as string);
    if (n)
      return NextResponse.json({ error: `${o.value} is asked for in ${n} request${n === 1 ? '' : 's'}, so it can’t be deleted. Change those requests first.` }, { status: 409 });
  }
  if (o.kind === 'step') {
    const { count } = await auth.svc
      .from('logistics_plan_steps')
      .select('step_id', { count: 'exact', head: true })
      .eq('step_id', o.id as string);
    if (count)
      return NextResponse.json({ error: `${o.value} has been used ${count} time${count === 1 ? '' : 's'} at events, so it can’t be deleted. Rename it instead.` }, { status: 409 });
  }
  if (o.kind === 'prize_step') {
    const { count } = await auth.svc
      .from('logistics_plan_prize_steps')
      .select('step_id', { count: 'exact', head: true })
      .eq('step_id', o.id as string);
    if (count) return NextResponse.json({ error: `${o.value} has been used at events, so it can’t be deleted. Rename it instead.` }, { status: 409 });
  }
  const used = await devicesUsing(auth.svc, o.kind as OptionKind, o.value as string);
  if (used.length)
    return NextResponse.json(
      {
        error: `${o.value} is used by ${used.length} ${o.kind === 'prize_size' ? 'prize or prize request' : 'device'}${used.length === 1 ? '' : 's'}. Change those first, or rename it instead.`,
      },
      { status: 409 },
    );
  await auth.svc
    .from('logistics_options')
    .delete()
    .eq('id', o.id as string);
  return NextResponse.json({ ok: true });
}
