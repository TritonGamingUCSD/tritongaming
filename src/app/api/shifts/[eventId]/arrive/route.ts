import { NextResponse } from 'next/server';
import { UUID, authorizeShifts, bad } from '@/lib/shiftsServer';
import { slotRange } from '@/lib/shifts';

export const dynamic = 'force-dynamic';

const EARLY_MS = 30 * 60_000;   // "I'm here" opens half an hour before the shift starts

// The person taps "I'm here" on a shift they signed up for: { station_id, slot_index, arrived? }. Only your own shift, from 30 minutes before it starts until it ends.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('view');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const stationId = String(b.station_id ?? '');
  const slot = Number(b.slot_index);
  if (!UUID.test(eventId) || !UUID.test(stationId) || !Number.isInteger(slot) || slot < 0) return bad('That shift does not exist.', 404);

  const [{ data: plan }, { data: mine }] = await Promise.all([
    auth.svc.from('event_shifts').select('starts_at, ends_at, slot_minutes').eq('event_id', eventId).maybeSingle(),
    auth.svc.from('shift_signups').select('id').eq('event_id', eventId).eq('station_id', stationId).eq('slot_index', slot).eq('user_id', auth.user.id).maybeSingle(),
  ]);
  if (!plan || !mine) return bad('You are not signed up for that shift.', 404);
  const arrived = b.arrived !== false;
  if (arrived) {
    const { start, end } = slotRange(plan as { starts_at: string; ends_at: string; slot_minutes: number }, slot);
    const now = Date.now();
    if (now < start.getTime() - EARLY_MS) return bad('It is too early to check in. You can tap I’m here 30 minutes before the shift.', 409);
    if (now > end.getTime()) return bad('That shift is already over.', 409);
  }
  const { error } = await auth.svc.from('shift_signups').update({ arrived_at: arrived ? new Date().toISOString() : null }).eq('id', mine.id as string);
  if (error) return bad('Couldn’t save that. Try again.', 500);
  return NextResponse.json({ ok: true });
}
