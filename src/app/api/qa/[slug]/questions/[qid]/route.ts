import { NextResponse } from 'next/server';
import { UUID, authorizePolls, broadcast } from '@/lib/polls/server';
import { hostView, loadSession, loadSessionFor } from '@/lib/qa/server';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'approved', 'hidden', 'answered'];

// One question, for the host. PATCH { status?: pending | approved | hidden | answered, spotlight?: boolean }: show it to the room (approve), keep it off (hide), mark it answered, or put it on (or take it off) the big screen.
// Only an approved question can be on the screen; a question that stops being approved comes off it. Both reply with the whole session, as the console shows it.
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; qid: string }> }) {
  const auth = await authorizePolls('host', 'Q&A');
  if (auth.error) return auth.error;
  const { slug, qid } = await params;
  const session = UUID.test(qid) ? await loadSessionFor(auth, slug) : null;
  if (!session) return NextResponse.json({ error: 'That question is gone.' }, { status: 404 });
  const { data: q } = await auth.svc.from('qa_questions').select('id, status').eq('id', qid).eq('session_id', session.id).maybeSingle();
  if (!q) return NextResponse.json({ error: 'That question is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  let status = q.status as string;
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return NextResponse.json({ error: 'That isn’t a state a question can be in.' }, { status: 400 });
    status = b.status;
    await auth.svc
      .from('qa_questions')
      .update({ status, answered_at: status === 'answered' ? new Date().toISOString() : null })
      .eq('id', qid);
  }
  let spotlight = session.spotlight_id;
  if (b.spotlight === true) {
    if (status !== 'approved') return NextResponse.json({ error: 'Only a question the room can see can go on the screen. Approve it first.' }, { status: 409 });
    spotlight = qid;
  } else if (b.spotlight === false && spotlight === qid) spotlight = null;
  if (status !== 'approved' && spotlight === qid) spotlight = null;
  if (spotlight !== session.spotlight_id) await auth.svc.from('qa_sessions').update({ spotlight_id: spotlight, updated_at: new Date().toISOString() }).eq('id', session.id);
  await broadcast(session.id, 'state', {});
  const fresh = await loadSession(auth.svc, session.id);
  return NextResponse.json(await hostView(auth.svc, fresh!));
}

// Remove a question for good (a spam one, say).
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; qid: string }> }) {
  const auth = await authorizePolls('host', 'Q&A');
  if (auth.error) return auth.error;
  const { slug, qid } = await params;
  const session = UUID.test(qid) ? await loadSessionFor(auth, slug) : null;
  if (!session) return NextResponse.json({ ok: true });
  await auth.svc.from('qa_questions').delete().eq('id', qid).eq('session_id', session.id);
  await broadcast(session.id, 'state', {});
  const fresh = await loadSession(auth.svc, session.id);
  return NextResponse.json(await hostView(auth.svc, fresh!));
}
