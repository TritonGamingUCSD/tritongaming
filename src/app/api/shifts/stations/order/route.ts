import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { UUID, authorizeShifts, bad, STATIONS_CHANNEL, notifyShifts } from '@/lib/shifts/shiftsServer';

export const dynamic = 'force-dynamic';

// Exec: put the stations in this order (the order of the grid, and of the tables within each area): { ids: [every station id, first to last] }.
export async function PUT(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String) : [];
  if (!ids.length || ids.length > 300 || ids.some((i) => !UUID.test(i)) || new Set(ids).size !== ids.length) return bad('That order is not valid.');
  const { data: have } = await auth.svc.from('shift_stations').select('id');
  const known = new Set((have ?? []).map((r) => r.id as string));
  if (ids.some((i) => !known.has(i))) return bad('A station in that list no longer exists. Reload and try again.', 409);
  const results = await Promise.all(ids.map((id, i) => auth.svc.from('shift_stations').update({ sort_order: i }).eq('id', id)));
  if (results.some((r) => r.error)) return bad('Couldn’t save the order.', 500);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift station', entityId: null, summary: 'Reordered the shift stations' });
  await notifyShifts(STATIONS_CHANNEL);
  return NextResponse.json({ ok: true });
}
