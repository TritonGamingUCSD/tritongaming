import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { UUID, authorizeShifts, bad, shiftSubject, notifyShifts } from '@/lib/shiftsServer';

export const dynamic = 'force-dynamic';

// Exec: mark that someone is away for part of an event: { user_id, starts_at, ends_at, needs }. They can't take shifts that overlap it, and need only `needs` shifts overall (set per person).
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const userId = String(b.user_id ?? '');
  const from = new Date(String(b.starts_at ?? ''));
  const to = new Date(String(b.ends_at ?? ''));
  const needs = Number(b.needs ?? 0);
  if (!UUID.test(eventId) || !UUID.test(userId)) return bad('Unknown person or event.', 404);
  if (!Number.isInteger(needs) || needs < 0 || needs > 48) return bad('Shifts needed must be a whole number from 0 to 48.');
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return bad('The end must be after the start.');
  const subject = await shiftSubject(auth.svc, eventId, userId);
  if (!subject) return bad('That person is not an officer, lead or exec, or the event does not exist.', 404);
  const { error } = await auth.svc.from('shift_absences').insert({ event_id: eventId, user_id: userId, starts_at: from.toISOString(), ends_at: to.toISOString(), needs, marked_by: auth.user.id });
  if (error) return bad('Couldn’t save that.', 500);
  // Shifts that now overlap their time away are taken off them.
  const { data: plan } = await auth.svc.from('event_shifts').select('starts_at, ends_at, slot_minutes').eq('event_id', eventId).maybeSingle();
  if (plan) {
    const { data: mine } = await auth.svc.from('shift_signups').select('id, slot_index').eq('event_id', eventId).eq('user_id', userId);
    const clash = (mine ?? []).filter((m) => {
      const start = new Date(new Date(plan.starts_at).getTime() + (m.slot_index as number) * (plan.slot_minutes as number) * 60_000);
      const end = new Date(start.getTime() + (plan.slot_minutes as number) * 60_000);
      return start < to && end > from;
    }).map((m) => m.id as string);
    if (clash.length) await auth.svc.from('shift_signups').delete().in('id', clash);
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: `Marked ${subject.who} away for part of the shifts at "${subject.title}" (needs ${needs})` });
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}

// Exec: take a time away off: { id }.
export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(eventId) || !UUID.test(id)) return bad('Not found.', 404);
  await auth.svc.from('shift_absences').delete().eq('id', id).eq('event_id', eventId);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: 'Took a time away off someone for an event’s shifts' });
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}
