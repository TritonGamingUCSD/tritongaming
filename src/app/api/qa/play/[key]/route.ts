import { NextResponse } from 'next/server';
import { CODE, UUID, authorizePolls } from '@/lib/polls/server';
import { rankQuestions } from '@/lib/qa/rank';
import { loadQuestions, loadSession } from '@/lib/qa/server';

export const dynamic = 'force-dynamic';

// A Q&A as a guest sees it (anyone with a session, a guest too): by its 6-digit code (to join) or its id. A draft is not visible. The questions the host approved (with their likes and whether you liked them), the one on the big screen,
// and your own questions with what became of them. Questions still waiting for the host, and hidden ones, are never given to anyone but whoever asked them.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await authorizePolls('vote');
  if (auth.error) return auth.error;
  const { key } = await params;
  const session = UUID.test(key) || CODE.test(key) ? await loadSession(auth.svc, key) : null;
  if (!session || session.status === 'draft') return NextResponse.json({ error: 'There is no Q&A with that code.' }, { status: 404 });
  const { questions, liked } = await loadQuestions(auth.svc, session.id, auth.user.id);
  const shown = rankQuestions(questions.filter((q) => q.status === 'approved' || q.status === 'answered'));
  return NextResponse.json({
    session: { id: session.id, name: session.name, status: session.status },
    spotlight_id: session.spotlight_id,
    questions: shown.map((q) => ({ id: q.id, body: q.body, author: q.author, status: q.status, likes: q.likes, liked: liked.has(q.id), mine: q.user_id === auth.user.id })),
    mine: questions.filter((q) => q.user_id === auth.user.id).map((q) => ({ id: q.id, body: q.body, status: q.status, created_at: q.created_at })),
  });
}
