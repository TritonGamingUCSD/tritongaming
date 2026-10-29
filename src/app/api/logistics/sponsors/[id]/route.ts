import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;
const t = (v: unknown, n: number) => {
  const s = String(v ?? '')
    .trim()
    .slice(0, n);
  return s || null;
};

// The small list of sponsors that lend or give equipment (and, later, prizes). A name, how to reach them, and a note.
// One sponsor: change it (PATCH) or remove it (DELETE).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = { ...(await request.json().catch(() => ({}))), id };
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if ('name' in b) {
    const name = t(b.name, 120);
    if (!name) return NextResponse.json({ error: 'The name can’t be empty.' }, { status: 400 });
    patch.name = name;
  }
  if ('contact' in b) patch.contact = t(b.contact, 300);
  if ('notes' in b) patch.notes = t(b.notes, 1000);
  const { data, error } = await auth.svc.from('logistics_sponsors').update(patch).eq('id', b.id).select('id, name, contact, notes').single();
  if (error || !data)
    return NextResponse.json({ error: error?.code === '23505' ? 'That sponsor is already in the list.' : 'Couldn’t save that.' }, { status: error?.code === '23505' ? 409 : 500 });
  return NextResponse.json({ sponsor: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = { ...(await request.json().catch(() => ({}))), id };
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await auth.svc.from('logistics_sponsors').delete().eq('id', b.id);
  return NextResponse.json({ ok: true });
}
