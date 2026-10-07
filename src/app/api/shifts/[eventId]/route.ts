import { NextResponse } from 'next/server';
import { UUID, authorizeShifts, bad, loadGrid } from '@/lib/shifts/shiftsServer';
import { alertStaleCovers } from '@/lib/shifts/shiftReminders';

export const dynamic = 'force-dynamic';

// The grid for one event (stations, slots, who signed up where). The live board polls this.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('view');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  if (!UUID.test(eventId)) return bad('Event not found.', 404);
  // Opening the grid also checks for cover requests that have sat too long (a daily job alone can't be that exact). Never holds up or fails the page.
  void alertStaleCovers(auth.svc).catch(() => {});
  const grid = await loadGrid(auth.svc, eventId, auth.user.id, auth.roles, auth.manage);
  if (!grid) return bad('Event not found.', 404);
  return NextResponse.json({ grid });
}
