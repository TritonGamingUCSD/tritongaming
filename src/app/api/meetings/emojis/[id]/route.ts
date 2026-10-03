import { NextResponse } from 'next/server';
import { authorizeMeetings } from '@/lib/meetings';
import { hasCapability } from '@/lib/capabilities';

const BUCKET = 'custom-emojis';
const UUID = /^[0-9a-f-]{36}$/i;

async function authorizeAny() {
  const a = await authorizeMeetings('attend_meetings').catch(() => null);
  if (a && !a.error) return a;
  return authorizeMeetings('host_meetings');
}

// PATCH: approve (exec/admin).
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { error } = await auth.svc.from('custom_emojis').update({ status: 'approved', reviewed_by: auth.user.id }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: exec/admin can remove any; the uploader can withdraw their own while it is still waiting.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAny();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: e } = await auth.svc.from('custom_emojis').select('path, status, created_by').eq('id', id).maybeSingle();
  if (!e) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const allowed = hasCapability(auth.roles, 'manage_meetings') || (e.created_by === auth.user.id && e.status === 'pending');
  if (!allowed) return NextResponse.json({ error: 'Only exec and admins can remove an approved emoji.' }, { status: 403 });
  await auth.svc.from('custom_emojis').delete().eq('id', id);
  await auth.svc.storage.from(BUCKET).remove([e.path as string]);
  return NextResponse.json({ ok: true });
}
