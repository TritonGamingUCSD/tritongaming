import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, canManageMeeting, notYourMeeting } from '@/lib/meetings';

export async function POST(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { meeting_id } = await request.json().catch(() => ({}));
  const { data: m } = meeting_id ? await auth.svc.from('meetings').select('id, title, meeting_date, created_by').eq('id', meeting_id).maybeSingle() : { data: null };
  if (!m) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  if (!canManageMeeting(auth, m.created_by as string | null)) return notYourMeeting();
  await auth.svc.from('meetings').update({ closed_at: new Date().toISOString() }).eq('id', m.id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'close', entityType: 'meeting', entityId: m.id, summary: `Closed check-in for "${m.title}" (${m.meeting_date})` });
  return NextResponse.json({ ok: true });
}
