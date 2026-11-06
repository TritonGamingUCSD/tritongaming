import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { loadTournament } from '@/lib/tournaments/store';
import { buildFeed } from '@/lib/tournaments/feed';

export const dynamic = 'force-dynamic';

// The data feed for the public page, stream overlays and any tool that wants it. Public tournaments need nothing; a draft or private one needs ?token=<its overlay token>.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const off = await getOffSwitches();
  if (off.includes('tournaments')) return NextResponse.json({ error: 'Tournaments are turned off.' }, { status: 403 });
  const data = await loadTournament(createServiceClient(), id);
  if (!data) return NextResponse.json({ error: 'No such tournament.' }, { status: 404 });
  const t = data.tournament;
  if (t.division_id && off.includes('div_tournaments')) return NextResponse.json({ error: 'Tournaments are turned off.' }, { status: 403 });
  const token = new URL(req.url).searchParams.get('token');
  const open = t.is_public && t.status !== 'draft';
  if (!open && token !== t.overlay_token) return NextResponse.json({ error: 'No such tournament.' }, { status: 404 });
  return NextResponse.json(buildFeed(t, data.entrants, data.matches, data.stages, data.stageEntrants), {
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}
