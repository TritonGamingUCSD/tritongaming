import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { UUID, authorizeShifts, bad } from '@/lib/shifts/shiftsServer';

export const dynamic = 'force-dynamic';

const COLS = 'id, name, body, sort_order';
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// Exec: saved write-ups for "what to do". { name, body } adds one.
export async function POST(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = clean(b.name, 60), body = clean(b.body, 4000);
  if (!name || !body) return bad('Give it a name and some text.');
  const { data: last } = await auth.svc.from('shift_templates').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await auth.svc.from('shift_templates').insert({ name, body, sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 }).select(COLS).single();
  if (error) return bad(error.code === '23505' ? 'A write-up with that name already exists.' : 'Couldn’t save that.', error.code === '23505' ? 409 : 500);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'shift station', entityId: data.id as string, summary: `Added the shift write-up "${name}"` });
  return NextResponse.json({ template: data });
}

// { id, name?, body? }
export async function PATCH(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Write-up not found.', 404);
  const patch: Record<string, string> = {};
  if ('name' in b) { const n = clean(b.name, 60); if (!n) return bad('Give it a name.'); patch.name = n; }
  if ('body' in b) { const t = clean(b.body, 4000); if (!t) return bad('Write something.'); patch.body = t; }
  if (!Object.keys(patch).length) return bad('Nothing to change.');
  const { data, error } = await auth.svc.from('shift_templates').update(patch).eq('id', id).select(COLS).maybeSingle();
  if (error) return bad(error.code === '23505' ? 'A write-up with that name already exists.' : 'Couldn’t save that.', error.code === '23505' ? 409 : 500);
  if (!data) return bad('Write-up not found.', 404);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift station', entityId: id, summary: `Edited the shift write-up "${data.name}"` });
  return NextResponse.json({ template: data });
}

// { id }
export async function DELETE(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Write-up not found.', 404);
  const { data: t } = await auth.svc.from('shift_templates').select('name').eq('id', id).maybeSingle();
  await auth.svc.from('shift_templates').delete().eq('id', id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'shift station', entityId: id, summary: `Removed the shift write-up "${t?.name ?? ''}"` });
  return NextResponse.json({ ok: true });
}
