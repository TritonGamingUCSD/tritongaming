import { NextResponse } from 'next/server';
import { UUID, authorizePolls, broadcast } from '@/lib/polls/server';
import { MAX_ASKED, MAX_AUTHOR, MAX_BODY, MAX_WAITING, cleanText } from '@/lib/qa/rank';
import { loadSession } from '@/lib/qa/server';

export const dynamic = 'force-dynamic';

// Send a question: { body, author? } by the session's id, only while it is open. It waits for the host before the room sees it. One person can have a few waiting at a time and send a few in all, so one phone can't flood the screen.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await authorizePolls('vote');
  if (auth.error) return auth.error;
  const { key } = await params;
  const session = UUID.test(key) ? await loadSession(auth.svc, key) : null;
  if (!session || session.status === 'draft') return NextResponse.json({ error: 'There is no Q&A with that code.' }, { status: 404 });
  if (session.status !== 'open') return NextResponse.json({ error: 'This Q&A is not taking questions any more.', closed: true }, { status: 409 });
  const b = await request.json().catch(() => ({}));
  const body = cleanText(b.body, MAX_BODY);
  if (!body) return NextResponse.json({ error: 'Type your question first.' }, { status: 400 });
  const { data: mine } = await auth.svc.from('qa_questions').select('status').eq('session_id', session.id).eq('user_id', auth.user.id).limit(100);
  if ((mine ?? []).length >= MAX_ASKED) return NextResponse.json({ error: `You have sent ${MAX_ASKED} questions, which is the most for one Q&A.` }, { status: 429 });
  if ((mine ?? []).filter((q) => q.status === 'pending').length >= MAX_WAITING)
    return NextResponse.json({ error: `You already have ${MAX_WAITING} questions waiting for the host. Wait for one to be shown first.` }, { status: 429 });
  const { data, error } = await auth.svc
    .from('qa_questions')
    .insert({ session_id: session.id, body, author: cleanText(b.author, MAX_AUTHOR), user_id: auth.user.id })
    .select('id, body, status, created_at')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t send your question. Try again.' }, { status: 500 });
  await broadcast(session.id, 'asked', {}, true);
  return NextResponse.json({ question: data }, { status: 201 });
}
