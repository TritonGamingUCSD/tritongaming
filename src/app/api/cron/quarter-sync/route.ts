import { NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/core/cronAuth';
import { createServiceClient } from '@/lib/supabase/admin';
import { syncInactive } from '@/lib/members/quarters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called daily (see vercel.json) with `Authorization: Bearer $CRON_SECRET`: when a new quarter begins, everyone not marked for it is active again,
// and anyone marked for it becomes inactive.
export async function GET(request: Request) {
  if (!cronAllowed(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const out = await syncInactive(createServiceClient());
  return NextResponse.json({ added: out.added.length, removed: out.removed.length, quarter: out.quarter });
}
