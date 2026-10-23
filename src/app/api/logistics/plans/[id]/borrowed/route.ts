import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { BORROWED_COLUMNS, LOCKED_MESSAGE, rowsLocked, UUID, touchPlan } from '@/lib/logistics/planServer';
import { cleanKit, cleanList, tagKey } from '@/lib/logistics/devices';

export const dynamic = 'force-dynamic';
const text = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null; };
const uuid = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);

// Sponsor and officer-loaner devices for ONE event. They are typed in here (not in the inventory), each with the ID it has that day. The ID only has to be unique within this plan,
// and can't be the same as a club device's ID (so typing it on the day always finds one thing).
async function clean(svc: ReturnType<typeof Object>, planId: string, b: Record<string, unknown>, existingId?: string) {
  const s = svc as import('@supabase/supabase-js').SupabaseClient;
  const out: Record<string, unknown> = {};
  if (!existingId || 'tag' in b) {
    const tag = text(b.tag, 40);
    if (!tag) return { error: 'Type the ID it has.' };
    const key = tagKey(tag);
    const { data: club } = await s.from('logistics_devices').select('tag').eq('tag_key', key).maybeSingle();
    if (club) return { error: `${club.tag} is already a club device’s ID. Use a different one for this borrowed device.` };
    let q = s.from('logistics_plan_borrowed').select('tag').eq('plan_id', planId).eq('tag_key', key);
    if (existingId) q = q.neq('id', existingId);
    const { data: same } = await q.maybeSingle();
    if (same) return { error: `${same.tag} is already used at this event.`, status: 409 };
    out.tag = tag;
  }
  if (!existingId || 'type' in b) { const type = text(b.type, 80); if (!type) return { error: 'Say what kind of device it is.' }; out.type = type; }
  if ('name' in b) out.name = text(b.name, 120);
  if (!existingId || 'owner_kind' in b) { if (b.owner_kind !== 'sponsor' && b.owner_kind !== 'officer') return { error: 'Say whose it is: a sponsor’s or an officer’s.' }; out.owner_kind = b.owner_kind; }
  const kind = (out.owner_kind ?? b.owner_kind) as string | undefined;
  if ('sponsor_id' in b || out.owner_kind) out.sponsor_id = kind === 'sponsor' ? uuid(b.sponsor_id) : null;
  if ('owner_user_id' in b || out.owner_kind) out.owner_user_id = kind === 'officer' ? uuid(b.owner_user_id) : null;
  if ('owner_note' in b) out.owner_note = text(b.owner_note, 300);
  if ('notes' in b) out.notes = text(b.notes, 1000);
  if ('games' in b) out.games = cleanList(b.games, 20);
  if ('kit' in b) out.kit = cleanKit(b.kit);
  if ('station_id' in b) {
    const sid = uuid(b.station_id);
    if (sid) { const { data: st } = await s.from('logistics_stations').select('id').eq('id', sid).eq('plan_id', planId).maybeSingle(); if (!st) return { error: 'That station is gone.' }; }
    out.station_id = sid;
  }
  return { value: out };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: plan } = await auth.svc.from('logistics_plans').select('id').eq('id', id).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'That plan is gone.' }, { status: 404 });
  const r = await clean(auth.svc, id, await request.json().catch(() => ({})));
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
  const { data, error } = await auth.svc.from('logistics_plan_borrowed').insert({ ...r.value, plan_id: id, created_by: auth.user.id }).select(BORROWED_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: error?.code === '23505' ? 'That ID is already used at this event.' : 'Couldn’t add it.' }, { status: error?.code === '23505' ? 409 : 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ borrowed: data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || !uuid(b.borrowed_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (await rowsLocked(auth.svc, id, { borrowedIds: [b.borrowed_id] })) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  const r = await clean(auth.svc, id, b, b.borrowed_id);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
  if (b.role === 'planned' || b.role === 'backup') (r.value as Record<string, unknown>).role = b.role;
  if (!Object.keys(r.value ?? {}).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { data, error } = await auth.svc.from('logistics_plan_borrowed').update(r.value!).eq('id', b.borrowed_id).eq('plan_id', id).select(BORROWED_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ borrowed: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || !uuid(b.borrowed_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (await rowsLocked(auth.svc, id, { borrowedIds: [b.borrowed_id] })) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 });
  await auth.svc.from('logistics_plan_borrowed').delete().eq('id', b.borrowed_id).eq('plan_id', id);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
