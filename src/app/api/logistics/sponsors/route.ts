import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';

export const dynamic = 'force-dynamic';
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
