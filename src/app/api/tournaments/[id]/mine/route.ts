import { NextResponse } from 'next/server';
import { withTournament, who } from '@/lib/tournaments/server';

export const dynamic = 'force-dynamic';

// Which entries in this tournament are the signed-in person's: one they signed up (or claimed), or a team they are on. Ids only; the public page matches them to its bracket to show "Your match". Anyone else gets an empty list.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'view');
  if ('error' in r) return r.error;
  const me = await who();
  if (!me) return NextResponse.json({ entrants: [] });
  const mine = r.entrants.filter((e) => e.user_id === me.user.id || (e.members ?? []).some((m) => m.user_id === me.user.id)).map((e) => ({ id: e.id, dropped: e.dropped }));
  return NextResponse.json({ entrants: mine });
}
