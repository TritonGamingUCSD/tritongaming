import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { LIMITS, OPTION_KINDS, type OptionKind } from '@/lib/logistics/constants';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;
const cleanValue = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, LIMITS.option);

// How many devices use a value (so a list entry that is in use can't be deleted, and a rename knows what to follow).
async function devicesUsing(svc: SupabaseClient, kind: OptionKind, value: string): Promise<{ id: string }[]> {
  const q = svc.from('logistics_devices').select('id, ports, games, kit');
  const { data } = kind === 'type' ? await q.eq('type', value) : kind === 'shelf' ? await q.eq('shelf', value) : kind === 'tier' ? await q.eq('tier', value)
    : kind === 'port' ? await q.contains('ports', [value]) : kind === 'game' ? await q.contains('games', [value]) : await q.contains('kit', [{ item: value }]);
  return (data ?? []) as { id: string }[];
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
  const meta = kind === 'type' ? { counted: b.counted === true } : {};
  const { data, error } = await auth.svc.from('logistics_options').insert({ kind, value, sort: ((last?.sort as number | undefined) ?? 0) + 1, meta }).select('id, value, meta').single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  return NextResponse.json({ option: { id: data.id, value: data.value, ...(kind === 'type' ? { counted: !!(data.meta as { counted?: boolean }).counted } : {}) } }, { status: 201 });
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
  if (typeof b.counted === 'boolean' && kind === 'type') patch.meta = { ...(o.meta as object), counted: b.counted };
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
  // Devices use the value as text, so a rename is followed here.
  if (typeof patch.value === 'string') {
    const old = o.value as string, now = patch.value;
    if (kind === 'type' || kind === 'shelf' || kind === 'tier') await auth.svc.from('logistics_devices').update({ [kind]: now }).eq(kind, old);
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
  const used = await devicesUsing(auth.svc, o.kind as OptionKind, o.value as string);
  if (used.length) return NextResponse.json({ error: `${o.value} is used by ${used.length} device${used.length === 1 ? '' : 's'}. Change those first, or rename it instead.` }, { status: 409 });
  await auth.svc.from('logistics_options').delete().eq('id', o.id as string);
  return NextResponse.json({ ok: true });
}
