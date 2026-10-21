import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;
const t = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null; };

// The small list of sponsors that lend or give equipment (and, later, prizes). A name, how to reach them, and a note.
export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = t(b.name, 120);
  if (!name) return NextResponse.json({ error: 'Type the sponsor’s name.' }, { status: 400 });
  const { data: dup } = await auth.svc.from('logistics_sponsors').select('id, name, contact, notes').ilike('name', name.replace(/[%_]/g, (c) => `\\${c}`)).maybeSingle();
  if (dup) return NextResponse.json({ sponsor: dup, existed: true });
  const { data, error } = await auth.svc.from('logistics_sponsors').insert({ name, contact: t(b.contact, 300), notes: t(b.notes, 1000) }).select('id, name, contact, notes').single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  return NextResponse.json({ sponsor: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if ('name' in b) { const name = t(b.name, 120); if (!name) return NextResponse.json({ error: 'The name can’t be empty.' }, { status: 400 }); patch.name = name; }
  if ('contact' in b) patch.contact = t(b.contact, 300);
  if ('notes' in b) patch.notes = t(b.notes, 1000);
  const { data, error } = await auth.svc.from('logistics_sponsors').update(patch).eq('id', b.id).select('id, name, contact, notes').single();
  if (error || !data) return NextResponse.json({ error: error?.code === '23505' ? 'That sponsor is already in the list.' : 'Couldn’t save that.' }, { status: error?.code === '23505' ? 409 : 500 });
  return NextResponse.json({ sponsor: data });
}

export async function DELETE(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { count } = await auth.svc.from('logistics_devices').select('id', { count: 'exact', head: true }).eq('sponsor_id', b.id);
  if (count) return NextResponse.json({ error: `This sponsor has ${count} device${count === 1 ? '' : 's'}. Change those first.` }, { status: 409 });
  await auth.svc.from('logistics_sponsors').delete().eq('id', b.id);
  return NextResponse.json({ ok: true });
}
