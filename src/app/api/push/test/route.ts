import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pushConfigured, sendTestPush } from '@/lib/webPush';

export const dynamic = 'force-dynamic';
const lastTest = new Map<string, number>();

// Send myself a test notification (to every device I turned it on for), at most one every 10 seconds.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'Push notifications aren’t set up on this site yet.' }, { status: 503 });
  const now = Date.now();
  if (now - (lastTest.get(user.id) ?? 0) < 10_000) return NextResponse.json({ error: 'Wait a few seconds before sending another test.' }, { status: 429 });
  lastTest.set(user.id, now);
  const sent = await sendTestPush(user.id);
  return NextResponse.json({ sent });
}
