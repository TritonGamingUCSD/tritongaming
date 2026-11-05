import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { authorizePolls, broadcast, freshCode } from '@/lib/polls/server';
import { cleanText, nextQuestion } from '@/lib/qa/rank';
import { QA_COLUMNS, hostView, loadQuestions, loadSessionFor } from '@/lib/qa/server';

export const dynamic = 'force-dynamic';

// One Q&A session, for its host (officers and above).
//   GET      the session and every question with its likes
//   PATCH    { name? } and/or { action }:
//              open (gives the code) · close (no new questions or likes) · reopen
//              approve_all (every waiting question is shown to the room)
//              next (the question on the screen is marked answered and the most liked one goes up) · clear_screen (nothing on the screen)
//   DELETE   remove the session with its questions and likes
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePolls('host', 'Q&A');
  if (auth.error) return auth.error;
  const session = await loadSessionFor(auth, (await params).slug);
  if (!session) return NextResponse.json({ error: 'That Q&A is gone.' }, { status: 404 });
  return NextResponse.json(await hostView(auth.svc, session));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePolls('host', 'Q&A');
  if (auth.error) return auth.error;
  const session = await loadSessionFor(auth, (await params).slug);
  if (!session) return NextResponse.json({ error: 'That Q&A is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (typeof b.name === 'string') {
    const n = cleanText(b.name, 80);
    if (!n) return NextResponse.json({ error: 'Give the Q&A a name.' }, { status: 400 });
    patch.name = n;
  }
  let announce: string | null = null;
  if (typeof b.action === 'string') {
    switch (b.action) {
      case 'open': {
        if (session.status !== 'draft')
          return NextResponse.json({ error: session.status === 'open' ? 'It is already open.' : 'Use Open Again for a closed Q&A.' }, { status: 409 });
        const code = await freshCode(auth.svc);
        if (!code) return NextResponse.json({ error: 'Couldn’t find a free code. Try again.' }, { status: 500 });
        Object.assign(patch, { status: 'open', code, opened_at: now });
        announce = 'Opened';
        break;
      }
      case 'close':
        if (session.status !== 'open') return NextResponse.json({ error: 'Only an open Q&A can be closed.' }, { status: 409 });
        Object.assign(patch, { status: 'closed', closed_at: now });
        announce = 'Closed';
        break;
      case 'reopen':
        if (session.status !== 'closed') return NextResponse.json({ error: 'Only a closed Q&A can be opened again.' }, { status: 409 });
        Object.assign(patch, { status: 'open', closed_at: null });
        announce = 'Opened again';
        break;
      case 'approve_all':
        await auth.svc.from('qa_questions').update({ status: 'approved' }).eq('session_id', session.id).eq('status', 'pending');
        break;
      case 'next': {
        const { questions } = await loadQuestions(auth.svc, session.id);
        if (session.spotlight_id) await auth.svc.from('qa_questions').update({ status: 'answered', answered_at: now }).eq('id', session.spotlight_id).eq('status', 'approved');
        const next = nextQuestion(
          questions.filter((q) => q.id !== session.spotlight_id),
          null,
        );
        patch.spotlight_id = next?.id ?? null;
        break;
      }
      case 'clear_screen':
        patch.spotlight_id = null;
        break;
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  }
  const { data, error } = await auth.svc.from('qa_sessions').update(patch).eq('id', session.id).select(QA_COLUMNS).single();
  if (error || !data)
    return NextResponse.json({ error: error?.code === '23505' ? 'That code was just taken. Try again.' : 'Couldn’t save that.' }, { status: error?.code === '23505' ? 409 : 500 });
  await broadcast(session.id, 'state', { status: data.status });
  if (announce) await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'qa', entityId: session.id, summary: `${announce} the Q&A “${data.name}”` });
  return NextResponse.json(await hostView(auth.svc, data as typeof session));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePolls('host', 'Q&A');
  if (auth.error) return auth.error;
  const session = await loadSessionFor(auth, (await params).slug);
  if (!session) return NextResponse.json({ ok: true });
  if (session.status === 'open') return NextResponse.json({ error: 'It is taking questions. Close it first.' }, { status: 409 });
  await auth.svc.from('qa_sessions').delete().eq('id', session.id); // its questions and likes go with it
  await broadcast(session.id, 'state', { status: 'gone' });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'qa', entityId: session.id, summary: `Deleted the Q&A “${session.name}”` });
  return NextResponse.json({ ok: true });
}
