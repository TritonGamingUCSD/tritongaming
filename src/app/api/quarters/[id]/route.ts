import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { authorizeQuarters, loadQuarters, quarterName, syncInactive } from '@/lib/members/quarters';

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Change a quarter's dates (admin).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeQuarters('setup');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Quarter not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const all = await loadQuarters(auth.svc);
  const q = all.find((x) => x.id === id);
  if (!q) return NextResponse.json({ error: 'Quarter not found.' }, { status: 404 });
  const starts = DATE.test(String(b.starts_on)) ? String(b.starts_on) : q.starts_on;
  const ends = DATE.test(String(b.ends_on)) ? String(b.ends_on) : q.ends_on;
  if (ends < starts) return NextResponse.json({ error: 'The quarter can’t end before it starts.' }, { status: 400 });
  if (all.some((x) => x.id !== id && x.starts_on <= ends && x.ends_on >= starts)) return NextResponse.json({ error: 'That overlaps another quarter.' }, { status: 400 });
  await auth.svc.from('academic_quarters').update({ starts_on: starts, ends_on: ends }).eq('id', id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'quarter', entityId: id, summary: `Changed the dates of ${quarterName(q)}` });
  await syncInactive(auth.svc);
  return NextResponse.json({ ok: true });
}

// Delete a quarter (admin); any inactive marks for it go with it.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeQuarters('setup');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Quarter not found.' }, { status: 404 });
  const q = (await loadQuarters(auth.svc)).find((x) => x.id === id);
  if (!q) return NextResponse.json({ error: 'Quarter not found.' }, { status: 404 });
  await auth.svc.from('academic_quarters').delete().eq('id', id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'quarter', entityId: id, summary: `Deleted ${quarterName(q)}` });
  await syncInactive(auth.svc);
  return NextResponse.json({ ok: true });
}
