import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings } from '@/lib/meetings';

// Exec fixes attendance by hand: add someone who forgot their phone, or remove a mistaken entry.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { user_id } = await request.json().catch(() => ({}));
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  const { data: m } = await auth.svc.from('meetings').select('title, meeting_date').eq('id', id).maybeSingle();
  if (!m) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  // Checking someone in clears any absence mark.
  await auth.svc.from('meeting_absences').delete().eq('meeting_id', id).eq('user_id', user_id);
  const { error } = await auth.svc.from('meeting_attendance')
    .upsert({ meeting_id: id, user_id, method: 'manual', added_by: auth.user.id }, { onConflict: 'meeting_id,user_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: 'Failed to add.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'add', entityType: 'meeting attendance', entityId: id, summary: `Manually checked someone in to ${m.title} (${m.meeting_date})`, details: { user_id } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { user_id } = await request.json().catch(() => ({}));
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  const { data: m } = await auth.svc.from('meetings').select('title, meeting_date').eq('id', id).maybeSingle();
  const { error } = await auth.svc.from('meeting_attendance').delete().eq('meeting_id', id).eq('user_id', user_id);
  if (error) return NextResponse.json({ error: 'Failed to remove.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'remove', entityType: 'meeting attendance', entityId: id, summary: `Removed someone from ${m?.title ?? 'meeting'} (${m?.meeting_date ?? ''})`, details: { user_id } });
  return NextResponse.json({ ok: true });
}
