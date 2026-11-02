import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { CODE } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

// Is this 6-digit code a poll that is being voted on? Open to anyone, signed in or not (the public /play page asks before anyone has a session): it says only that there is such a poll and what it is called, never anything about its entries or votes.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE.test(code)) return NextResponse.json({ poll: false });
  const { data } = await createServiceClient().from('polls').select('name, status').eq('code', code).in('status', ['open', 'closed']).maybeSingle();
  return NextResponse.json(data ? { poll: true, name: data.name, status: data.status } : { poll: false });
}
