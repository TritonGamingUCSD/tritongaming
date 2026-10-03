import { NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/cronAuth';
import { createServiceClient } from '@/lib/supabase/admin';
import { runTeamSync } from '@/lib/teamYears';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called daily (see vercel.json) with `Authorization: Bearer $CRON_SECRET`: records today's team roster, archives years whose Spring has ended, and (when an
// admin has turned it on) moves graduates to Alumni.
export async function GET(request: Request) {
  if (!cronAllowed(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runTeamSync(createServiceClient()));
}
