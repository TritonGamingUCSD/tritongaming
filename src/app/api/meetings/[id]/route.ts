import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { authorizeMeetings, canManageMeeting, notYourMeeting } from '@/lib/meetings/meetings';

// Delete a meeting for good, including its attendance, answers and reactions. Exec only. To just
// skip one week of a repeating meeting, use /api/meetings/cancel instead (it can be restored).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data: m } = await auth.svc.from('meetings').select('title, meeting_date, created_by').eq('id', id).maybeSingle();
  if (!m) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  if (!canManageMeeting(auth, m.created_by as string | null)) return notYourMeeting();
  const { count } = await auth.svc.from('meeting_attendance').select('user_id', { count: 'exact', head: true }).eq('meeting_id', id);
  const { error } = await auth.svc.from('meetings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'meeting', entityId: id, summary: `Deleted "${m.title}" (${m.meeting_date}) and its ${count ?? 0} check-in${count === 1 ? '' : 's'}` });
  return NextResponse.json({ ok: true });
}
