import { NextResponse } from 'next/server';
import { UUID, authorizeShifts, bad, notifyShifts } from '@/lib/shifts/shiftsServer';

export const dynamic = 'force-dynamic';

// Tick an item on a station's checklist, or untick it: { item_id, done }. Anyone working that station at this event may (exec always).
// The tick is shared: everyone on the station sees it and who did it.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('view');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const itemId = String(b.item_id ?? '');
  if (!UUID.test(eventId) || !UUID.test(itemId)) return bad('Item not found.', 404);
  const { data: item } = await auth.svc.from('shift_checklist_items').select('id, station_id').eq('id', itemId).eq('event_id', eventId).maybeSingle();
  if (!item) return bad('Item not found.', 404);
  if (!auth.manage) {
    const { data: on } = await auth.svc.from('shift_signups').select('id').eq('event_id', eventId).eq('station_id', item.station_id as string).eq('user_id', auth.user.id).limit(1);
    if (!on?.length) return bad('Only people on this station’s shift can tick its checklist.', 403);
  }
  const done = b.done !== false;
  const { error } = await auth.svc.from('shift_checklist_items').update(done ? { done_by: auth.user.id, done_at: new Date().toISOString() } : { done_by: null, done_at: null }).eq('id', itemId);
  if (error) return bad('Couldn’t save that.', 500);
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}
