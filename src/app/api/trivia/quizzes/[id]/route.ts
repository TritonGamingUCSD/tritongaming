import { NextResponse } from 'next/server';
import { authorizeTrivia, findQuiz } from '@/lib/trivia/server';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// A quiz and its whole pool of questions.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const quiz = await findQuiz(auth.svc, (await params).id);
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  const { data } = await auth.svc.from('trivia_questions').select('id, sort, text, choices, correct, secs').eq('quiz_id', quiz.id).order('sort').order('created_at').limit(1000);
  return NextResponse.json({ quiz, questions: data ?? [] });
}

// Rename a quiz, or change how many questions a game draws.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const quiz = await findQuiz(auth.svc, (await params).id);
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === 'string') { const name = b.name.trim().slice(0, 80); if (!name) return NextResponse.json({ error: 'Give the quiz a name.' }, { status: 400 }); patch.name = name; }
  if (b.per_game !== undefined) { const n = Math.round(Number(b.per_game)); if (!Number.isFinite(n) || n < 1 || n > 100) return NextResponse.json({ error: 'A game asks between 1 and 100 questions.' }, { status: 400 }); patch.per_game = n; }
  const { data, error } = await auth.svc.from('trivia_quizzes').update(patch).eq('id', quiz.id).select('id, slug, name, per_game, created_at').single();
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  return NextResponse.json({ quiz: data });
}

// Delete a quiz with its pool, its games and their results.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const quiz = await findQuiz(auth.svc, (await params).id);
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  const live = await auth.svc.from('trivia_games').select('id', { count: 'exact', head: true }).eq('quiz_id', quiz.id).neq('status', 'done');
  if (live.count) return NextResponse.json({ error: 'A game of this quiz is still running. End it first.' }, { status: 409 });
  const { error } = await auth.svc.from('trivia_quizzes').delete().eq('id', quiz.id);
  if (error) return NextResponse.json({ error: 'Couldn’t delete that.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'remove', entityType: 'trivia quiz', entityId: quiz.id, summary: `Deleted the Trivia quiz “${quiz.name}”` });
  return NextResponse.json({ ok: true });
}
