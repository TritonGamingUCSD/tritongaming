import { NextResponse } from 'next/server';
import { UUID, authorizeShifts, bad, loadGrid } from '@/lib/shiftsServer';

export const dynamic = 'force-dynamic';

// The grid for one event (stations, slots, who signed up where). The live board polls this.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('view');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  if (!UUID.test(eventId)) return bad('Event not found.', 404);
  const grid = await loadGrid(auth.svc, eventId, auth.user.id, auth.roles, auth.manage);
  if (!grid) return bad('Event not found.', 404);
  return NextResponse.json({ grid });
}
