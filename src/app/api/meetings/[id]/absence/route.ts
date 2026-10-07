import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { authorizeMeetings, guardMeeting } from '@/lib/meetings/meetings';
import { notifyMeetingLive } from '@/lib/meetings/meetingLive';

// Exec marks someone absent for a meeting (with an optional reason; "excused" absences don't count
// against their attendance), or takes the mark back off.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  { const denied = await guardMeeting(auth, id); if (denied) return denied; }
  const b = await request.json().catch(() => ({}));
  if (!b.user_id || !/^[0-9a-f-]{36}$/i.test(String(b.user_id))) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  const { data: m } = await auth.svc.from('meetings').select('title, meeting_date').eq('id', id).maybeSingle();
  if (!m) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

  // Someone marked absent can't also be recorded as present.
  await auth.svc.from('meeting_attendance').delete().eq('meeting_id', id).eq('user_id', b.user_id);
  await auth.svc.from('meeting_answers').delete().eq('meeting_id', id).eq('user_id', b.user_id);
  const reason = String(b.reason ?? '').trim().slice(0, 140) || null;
  const excused = b.excused !== false;
  const { error } = await auth.svc.from('meeting_absences').upsert({ meeting_id: id, user_id: b.user_id, reason, excused, marked_by: auth.user.id }, { onConflict: 'meeting_id,user_id' });
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'mark absent', entityType: 'meeting attendance', entityId: id, summary: `Marked someone ${excused ? 'excused' : 'absent'} for ${m.title} (${m.meeting_date})${reason ? `: ${reason}` : ''}`, details: { user_id: b.user_id } });
  await notifyMeetingLive(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  { const denied = await guardMeeting(auth, id); if (denied) return denied; }
  const { user_id } = await request.json().catch(() => ({}));
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  await auth.svc.from('meeting_absences').delete().eq('meeting_id', id).eq('user_id', user_id);
  await notifyMeetingLive(id);
  return NextResponse.json({ ok: true });
}
