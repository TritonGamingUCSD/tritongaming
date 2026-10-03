import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { KEY_COLORS, authorizeKeys } from '@/lib/storageKeys';

const UUID = /^[0-9a-f-]{36}$/i;

// Rename a key or change its color (exec and admin).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeKeys('manage_keys');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  const { data: k } = await auth.svc.from('storage_keys').select('id, name').eq('id', id).maybeSingle();
  if (!k) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if ('name' in b) { const n = String(b.name ?? '').trim().slice(0, 60); if (!n) return NextResponse.json({ error: 'Give the key a name.' }, { status: 400 }); patch.name = n; }
  if ('color' in b) { if (!(KEY_COLORS as readonly string[]).includes(b.color)) return NextResponse.json({ error: 'Pick one of the colors.' }, { status: 400 }); patch.color = b.color; }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { error } = await auth.svc.from('storage_keys').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  await auth.svc.from('storage_key_events').insert({ key_id: id, actor_id: auth.user.id, kind: 'edited', note: Object.keys(patch).join(', ') });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'storage key', entityId: id, summary: `Changed the key "${k.name}"` });
  return NextResponse.json({ ok: true });
}

// Remove a key that no longer exists (lost, replaced). Exec and admin only. Its history goes with it.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeKeys('manage_keys');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  const { data: k } = await auth.svc.from('storage_keys').select('id, name').eq('id', id).maybeSingle();
  if (!k) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  await auth.svc.from('storage_keys').delete().eq('id', id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'storage key', entityId: id, summary: `Removed the key "${k.name}"` });
  return NextResponse.json({ ok: true });
}
