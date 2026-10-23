import { NextResponse } from 'next/server';
import { followBundle, requestsUsingBundle } from '@/lib/logistics/requestRows';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LIMITS, OPTION_KINDS, type OptionKind } from '@/lib/logistics/constants';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;
const APPLIES = ['all', 'club', 'borrowed'];
// A bundle's items: only device types that exist, each with a whole quantity.
async function cleanItems(svc: SupabaseClient, raw: unknown): Promise<{ items?: { type: string; qty: number }[]; error?: string }> {
  if (!Array.isArray(raw)) return { error: 'A bundle needs at least one item.' };
  const { data: types } = await svc.from('logistics_options').select('value').eq('kind', 'type');
  const known = new Map((types ?? []).map((t) => [(t.value as string).toLowerCase(), t.value as string]));
  const items: { type: string; qty: number }[] = [];
  for (const x of raw.slice(0, 12)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const type = known.get(String(o.type ?? '').trim().toLowerCase());
    if (!type) return { error: `“${String(o.type ?? '')}” isn’t a device type.` };
    items.push({ type, qty: Math.min(20, Math.max(1, Math.round(Number(o.qty)) || 1)) });
  }
  return items.length ? { items } : { error: 'A bundle needs at least one item.' };
}
const cleanValue = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, LIMITS.option);

// How many devices use a value (so a list entry that is in use can't be deleted, and a rename knows what to follow).
async function devicesUsing(svc: SupabaseClient, kind: OptionKind, value: string): Promise<{ id: string }[]> {
  if (kind === 'step' || kind === 'bundle' || kind === 'prize_step') return [];   // steps are checked against the steps already done, bundles are used by nothing
  if (kind === 'prize_size') {
    const { data } = await svc.from('logistics_prizes').select('id').eq('size', value);
    const { data: asked } = await svc.from('logistics_requests').select('id, items').eq('kind', 'prizes').limit(3000);
    return [...(data ?? []), ...(asked ?? []).filter((q) => ((q.items as { size?: string }[]) ?? []).some((i) => i.size === value))].map((x) => ({ id: x.id as string }));
  }
  const q = svc.from('logistics_devices').select('id, ports, games, kit');
  const { data } = kind === 'type' ? await q.eq('type', value) : kind === 'shelf' ? await q.eq('shelf', value) : kind === 'tier' ? await q.eq('tier', value)
    : kind === 'port' ? await q.contains('ports', [value]) : kind === 'game' ? await q.contains('games', [value]) : await q.contains('kit', [{ item: value }]);
  return (data ?? []) as { id: string }[];
}

// A prize size is kept as text on the prizes, on the lines of prize requests and in the pools made from them, so a rename is followed in all three.
async function followPrizeSize(svc: SupabaseClient, old: string, now: string) {
  await svc.from('logistics_prizes').update({ size: now }).eq('size', old);
  const { data: asked } = await svc.from('logistics_requests').select('id, items').eq('kind', 'prizes').limit(3000);
  for (const q of asked ?? []) {
    const items = (q.items as { qty: number; size: string }[]) ?? [];
    if (items.some((i) => i.size === old)) await svc.from('logistics_requests').update({ items: items.map((i) => (i.size === old ? { ...i, size: now } : i)) }).eq('id', q.id as string);
  }
  const { data: pools } = await svc.from('logistics_plan_pools').select('id, target_sizes').not('target_sizes', 'is', null).limit(3000);
  for (const p of pools ?? []) {
    const t = p.target_sizes as Record<string, number>;
    if (old in t) { const { [old]: n, ...rest } = t; await svc.from('logistics_plan_pools').update({ target_sizes: { ...rest, [now]: (rest[now] ?? 0) + n } }).eq('id', p.id as string); }
  }
}

// Add a value to a dropdown list. Adding one that already exists (any capitalisation) just returns it, so "add while picking" never fails on a duplicate.
export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const kind = b.kind as OptionKind;
  const value = cleanValue(b.value);
  if (!OPTION_KINDS.includes(kind) || !value) return NextResponse.json({ error: 'Type a name to add.' }, { status: 400 });
  const { data: dup } = await auth.svc.from('logistics_options').select('id, value, meta').eq('kind', kind).ilike('value', value.replace(/[%_]/g, (c) => `\\${c}`)).maybeSingle();
  if (dup) return NextResponse.json({ option: { id: dup.id, value: dup.value, ...(kind === 'type' ? { counted: !!(dup.meta as { counted?: boolean } | null)?.counted } : {}) }, existed: true });
  const { data: last } = await auth.svc.from('logistics_options').select('sort').eq('kind', kind).order('sort', { ascending: false }).limit(1).maybeSingle();
  let meta: Record<string, unknown> = kind === 'type' ? { counted: b.counted === true } : {};
  if (kind === 'step') meta = { applies: APPLIES.includes(b.applies) ? b.applies : 'all', kit: b.kit === true };
  if (kind === 'bundle') { const r = await cleanItems(auth.svc, b.items); if (r.error) return NextResponse.json({ error: r.error }, { status: 400 }); meta = { items: r.items }; }
  if (kind === 'prize_step') meta = { gives: b.gives === true, leftover: b.leftover === true };
  const { data, error } = await auth.svc.from('logistics_options').insert({ kind, value, sort: ((last?.sort as number | undefined) ?? 0) + 1, meta }).select('id, value, meta').single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  return NextResponse.json({ option: { id: data.id, value: data.value, ...(kind === 'type' ? { counted: !!(data.meta as { counted?: boolean }).counted } : {}), ...(kind === 'step' ? { applies: (meta as { applies: string }).applies, kit: (meta as { kit?: boolean }).kit === true } : {}), ...(kind === 'prize_step' ? { gives: (meta as { gives?: boolean }).gives === true, leftover: (meta as { leftover?: boolean }).leftover === true } : {}), ...(kind === 'bundle' ? { items: (meta as { items: unknown }).items } : {}) } }, { status: 201 });
}

// Rename a value (devices that use it follow the new name) or switch a device type between individual and counted.
export async function PATCH(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: o } = await auth.svc.from('logistics_options').select('id, kind, value, meta').eq('id', b.id).maybeSingle();
  if (!o) return NextResponse.json({ error: 'That entry is gone.' }, { status: 404 });
  const kind = o.kind as OptionKind;
  const patch: Record<string, unknown> = {};
  if ((typeof b.counted === 'boolean' || typeof b.main === 'boolean') && kind === 'type') patch.meta = { ...(o.meta as object), ...(typeof b.counted === 'boolean' ? { counted: b.counted } : {}), ...(typeof b.main === 'boolean' ? { main: b.main } : {}) };
  if (kind === 'step' && (typeof b.applies === 'string' || typeof b.kit === 'boolean')) {
    if (typeof b.applies === 'string' && !APPLIES.includes(b.applies)) return NextResponse.json({ error: 'Pick which devices the step is for.' }, { status: 400 });
    patch.meta = { ...(o.meta as object), ...(typeof b.applies === 'string' ? { applies: b.applies } : {}), ...(typeof b.kit === 'boolean' ? { kit: b.kit } : {}) };
  }
  if (kind === 'prize_step' && (typeof b.gives === 'boolean' || typeof b.leftover === 'boolean')) patch.meta = { ...(o.meta as object), ...(typeof b.gives === 'boolean' ? { gives: b.gives } : {}), ...(typeof b.leftover === 'boolean' ? { leftover: b.leftover } : {}) };
  if (kind === 'bundle' && 'items' in b) { const r = await cleanItems(auth.svc, b.items); if (r.error) return NextResponse.json({ error: r.error }, { status: 400 }); patch.meta = { ...(o.meta as object), items: r.items }; }
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
      const { data: dup } = await auth.svc.from('logistics_options').select('id').eq('kind', kind).ilike('value', value.replace(/[%_]/g, (c) => `\\${c}`)).neq('id', o.id as string).maybeSingle();
      if (dup) return NextResponse.json({ error: `${value} is already in the list.` }, { status: 409 });
      patch.value = value;
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
  const { error } = await auth.svc.from('logistics_options').update(patch).eq('id', o.id as string);
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (kind === 'bundle' && (patch.meta || typeof patch.value === 'string')) await followBundle(auth.svc, o.value as string, typeof patch.value === 'string' ? patch.value : (o.value as string));
  // Devices use the value as text, so a rename is followed here.
  if (typeof patch.value === 'string') {
    const old = o.value as string, now = patch.value;
    if (kind === 'prize_step') { /* nothing to follow: steps are kept by id */ }
    else if (kind === 'prize_size') await followPrizeSize(auth.svc, old, now);
    else if (kind === 'type' || kind === 'shelf' || kind === 'tier') await auth.svc.from('logistics_devices').update({ [kind]: now }).eq(kind, old);
    else {
      const rows = (await devicesUsing(auth.svc, kind, old)) as unknown as { id: string; ports: string[]; games: string[]; kit: { item: string }[] }[];
      for (const r of rows) {
        const upd = kind === 'port' ? { ports: r.ports.map((x) => (x === old ? now : x)) } : kind === 'game' ? { games: r.games.map((x) => (x === old ? now : x)) } : { kit: r.kit.map((k) => (k.item === old ? { ...k, item: now } : k)) };
        await auth.svc.from('logistics_devices').update(upd).eq('id', r.id);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: o } = await auth.svc.from('logistics_options').select('id, kind, value').eq('id', b.id).maybeSingle();
  if (!o) return NextResponse.json({ ok: true });
  if (o.kind === 'bundle') {
    const n = await requestsUsingBundle(auth.svc, o.value as string);
    if (n) return NextResponse.json({ error: `${o.value} is asked for in ${n} request${n === 1 ? '' : 's'}, so it can’t be deleted. Change those requests first.` }, { status: 409 });
  }
  if (o.kind === 'step') {
    const { count } = await auth.svc.from('logistics_plan_steps').select('step_id', { count: 'exact', head: true }).eq('step_id', o.id as string);
    if (count) return NextResponse.json({ error: `${o.value} has been used ${count} time${count === 1 ? '' : 's'} at events, so it can’t be deleted. Rename it instead.` }, { status: 409 });
  }
  if (o.kind === 'prize_step') {
    const { count } = await auth.svc.from('logistics_plan_prize_steps').select('step_id', { count: 'exact', head: true }).eq('step_id', o.id as string);
    if (count) return NextResponse.json({ error: `${o.value} has been used at events, so it can’t be deleted. Rename it instead.` }, { status: 409 });
  }
  const used = await devicesUsing(auth.svc, o.kind as OptionKind, o.value as string);
  if (used.length) return NextResponse.json({ error: `${o.value} is used by ${used.length} ${o.kind === 'prize_size' ? 'prize or prize request' : 'device'}${used.length === 1 ? '' : 's'}. Change those first, or rename it instead.` }, { status: 409 });
  await auth.svc.from('logistics_options').delete().eq('id', o.id as string);
  return NextResponse.json({ ok: true });
}
