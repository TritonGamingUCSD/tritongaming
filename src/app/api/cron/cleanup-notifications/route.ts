import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { cleanupNotifications } from '@/lib/notificationCleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called daily (see vercel.json) with `Authorization: Bearer $CRON_SECRET`: deletes old notifications (read ones after 30 days, anything after 90).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await cleanupNotifications(createServiceClient()));
}
