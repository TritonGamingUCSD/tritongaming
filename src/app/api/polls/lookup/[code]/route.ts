import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { CODE } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

// Is this 6-digit code a poll that is being voted on (or a Q&A taking questions)? Open to anyone, signed in or not (the public /play page asks before anyone has a session): it says only that there is such a poll and what it is called, never anything about its entries or votes.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE.test(code)) return NextResponse.json({ poll: false });
  const svc = createServiceClient();
  const { data } = await svc.from('polls').select('name, status').eq('code', code).in('status', ['open', 'closed']).maybeSingle();
  if (data) return NextResponse.json({ poll: true, kind: 'poll', name: data.name, status: data.status });
  // a Q&A is joined on the same page (/vote/<code>), so it answers the same way
  const { data: qa } = await svc.from('qa_sessions').select('name, status').eq('code', code).in('status', ['open', 'closed']).maybeSingle();
  return NextResponse.json(qa ? { poll: true, kind: 'qa', name: qa.name, status: qa.status } : { poll: false });
}
