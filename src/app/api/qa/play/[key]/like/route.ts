import { NextResponse } from 'next/server';
import { UUID, authorizePolls } from '@/lib/polls/server';
import { loadSession } from '@/lib/qa/server';

export const dynamic = 'force-dynamic';

// Like a question (or take the like back): { question_id, on }. Only an approved question of an open Q&A, and one like per person.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await authorizePolls('vote');
  if (auth.error) return auth.error;
  const { key } = await params;
  const session = UUID.test(key) ? await loadSession(auth.svc, key) : null;
  if (!session || session.status === 'draft') return NextResponse.json({ error: 'There is no Q&A with that code.' }, { status: 404 });
  if (session.status !== 'open') return NextResponse.json({ error: 'This Q&A is closed.', closed: true }, { status: 409 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.question_id !== 'string' || !UUID.test(b.question_id)) return NextResponse.json({ error: 'Pick a question.' }, { status: 400 });
  const { data: q } = await auth.svc.from('qa_questions').select('id').eq('id', b.question_id).eq('session_id', session.id).eq('status', 'approved').maybeSingle();
  if (!q) return NextResponse.json({ error: 'That question isn’t there any more.' }, { status: 404 });
  const r = b.on
    ? await auth.svc.from('qa_likes').upsert({ question_id: q.id, user_id: auth.user.id }, { onConflict: 'question_id,user_id', ignoreDuplicates: true })
    : await auth.svc.from('qa_likes').delete().eq('question_id', q.id).eq('user_id', auth.user.id);
  if (r.error) return NextResponse.json({ error: 'Couldn’t save that. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
