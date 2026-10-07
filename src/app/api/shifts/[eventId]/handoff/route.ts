import { NextResponse } from 'next/server';
import { UUID, authorizeShifts, bad, notifyShifts } from '@/lib/shifts/shiftsServer';

export const dynamic = 'force-dynamic';

// A hand-off note for the next person at a station: { station_id, body }. Anyone working that station at this event may leave one (exec always).
// It shows at the top of that station's guide for this event.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('view');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const stationId = String(b.station_id ?? '');
  const body = String(b.body ?? '').trim().slice(0, 500);
  if (!UUID.test(eventId) || !UUID.test(stationId)) return bad('Station not found.', 404);
  if (!body) return bad('Write a note first.');
  if (!auth.manage) {
    const { data: on } = await auth.svc.from('shift_signups').select('id').eq('event_id', eventId).eq('station_id', stationId).eq('user_id', auth.user.id).limit(1);
    if (!on?.length) return bad('Only people on this station’s shift can leave a note.', 403);
  }
  const { error } = await auth.svc.from('shift_handoff_notes').insert({ event_id: eventId, station_id: stationId, author_id: auth.user.id, body });
  if (error) return bad('Couldn’t save that.', 500);
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}
