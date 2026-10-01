import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings } from '@/lib/meetings';
import { cleanMemberIds as cleanMembers } from '@/lib/meetingAudience';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if ('name' in b) { const n = String(b.name ?? '').trim().slice(0, 60); if (!n) return NextResponse.json({ error: 'Give the group a name.' }, { status: 400 }); patch.name = n; }
  if ('member_ids' in b) { const m = cleanMembers(b.member_ids); if (!m || m.length === 0) return NextResponse.json({ error: 'Pick at least one person.' }, { status: 400 }); patch.member_ids = m; }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { data, error } = await auth.svc.from('meeting_groups').update(patch).eq('id', id).select('id, name, member_ids').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'meeting group', entityId: id, summary: `Updated meeting group "${data.name}"` });
  return NextResponse.json({ group: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data } = await auth.svc.from('meeting_groups').select('name').eq('id', id).maybeSingle();
  const { error } = await auth.svc.from('meeting_groups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'meeting group', entityId: id, summary: `Deleted meeting group "${data?.name ?? ''}"` });
  return NextResponse.json({ ok: true });
}
