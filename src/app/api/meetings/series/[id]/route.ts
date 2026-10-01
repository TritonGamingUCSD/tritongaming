import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, validateDocUrl } from '@/lib/meetings';

// Pause/resume a repeating meeting, or delete it (past meetings and their attendance are kept).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  if ('doc_url' in body) {
    const doc = validateDocUrl(body.doc_url);
    if (!doc.ok) return NextResponse.json({ error: 'The doc link must start with https:// (or be a path on this site).' }, { status: 400 });
    patch.doc_url = doc.value;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { data, error } = await auth.svc.from('meeting_series').update(patch).eq('id', id).select('title').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Failed to update.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'meeting series', entityId: id, summary: `Updated repeating meeting "${data.title}"`, details: patch });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data } = await auth.svc.from('meeting_series').select('title').eq('id', id).maybeSingle();
  const { error } = await auth.svc.from('meeting_series').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'meeting series', entityId: id, summary: `Deleted repeating meeting "${data?.title ?? ''}"` });
  return NextResponse.json({ ok: true });
}
