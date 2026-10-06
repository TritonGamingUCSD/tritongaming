import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { UUID, authorizeShifts, bad, shiftSubject } from '@/lib/shiftsServer';

export const dynamic = 'force-dynamic';

// Exec: exempt someone from the shift requirement for this event (they have a dedicated job): { user_id, note? }. They can still sign up.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const userId = String(b.user_id ?? '');
  const note = String(b.note ?? '').trim().slice(0, 160) || null;
  if (!UUID.test(eventId) || !UUID.test(userId)) return bad('Unknown person or event.', 404);
  const subject = await shiftSubject(auth.svc, eventId, userId);
  if (!subject) return bad('That person is not an officer, lead or exec, or the event does not exist.', 404);
  const { error } = await auth.svc.from('shift_exemptions').upsert({ event_id: eventId, user_id: userId, note, marked_by: auth.user.id }, { onConflict: 'event_id,user_id' });
  if (error) return bad('Couldn’t save that.', 500);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: `Exempted ${subject.who} from the shift requirement for "${subject.title}"${note ? ` (${note})` : ''}` });
  return NextResponse.json({ ok: true });
}

// Exec: take an exemption off: { id }.
export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(eventId) || !UUID.test(id)) return bad('Not found.', 404);
  await auth.svc.from('shift_exemptions').delete().eq('id', id).eq('event_id', eventId);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: 'Took an exemption off someone for an event’s shifts' });
  return NextResponse.json({ ok: true });
}
