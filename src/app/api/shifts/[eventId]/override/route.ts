import { NextResponse } from 'next/server';
import { UUID, authorizeShifts, bad, notifyShifts } from '@/lib/shifts/shiftsServer';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// Exec: change how many people one cell needs: { station_id, slot_index, needed } (needed: null goes back to the station's default).
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const stationId = String(b.station_id ?? '');
  const slot = Number(b.slot_index);
  if (!UUID.test(eventId) || !UUID.test(stationId) || !Number.isInteger(slot) || slot < 0) return bad('That cell does not exist.', 404);
  const [{ data: ev }, { data: st }] = await Promise.all([
    auth.svc.from('events').select('title').eq('id', eventId).maybeSingle(),
    auth.svc.from('shift_stations').select('name, default_needed').eq('id', stationId).maybeSingle(),
  ]);
  if (b.needed === null) {
    await auth.svc.from('shift_overrides').delete().eq('event_id', eventId).eq('station_id', stationId).eq('slot_index', slot);
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: `Set ${st?.name ?? 'a station'}, slot ${slot + 1} back to the usual ${st?.default_needed ?? ''} people for "${ev?.title ?? 'an event'}"` });
    await notifyShifts(eventId);
    return NextResponse.json({ ok: true });
  }
  const needed = Number(b.needed);
  if (!Number.isInteger(needed) || needed < 0 || needed > 50) return bad('Choose a number from 0 to 50.');
  const { error } = await auth.svc.from('shift_overrides').upsert({ event_id: eventId, station_id: stationId, slot_index: slot, needed }, { onConflict: 'event_id,station_id,slot_index' });
  if (error) return bad('Couldn’t save that.', 500);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: `Set ${st?.name ?? 'a station'}, slot ${slot + 1} to ${needed} people for "${ev?.title ?? 'an event'}"` });
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}
