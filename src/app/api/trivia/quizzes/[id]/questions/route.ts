import { NextResponse } from 'next/server';
import { authorizeTrivia, findQuiz, UUID } from '@/lib/trivia/server';
import { CHOICES, DEFAULT_SECS, MAX_SECS, MIN_SECS } from '@/lib/trivia/game';

export const dynamic = 'force-dynamic';
const COLS = 'id, sort, text, choices, correct, secs';
const MAX_QUESTIONS = 1000;

// What a client may set on a question, checked; anything not given is left alone.
function clean(b: Record<string, unknown>): { patch: Record<string, unknown> } | { error: string } {
  const patch: Record<string, unknown> = {};
  if (b.text !== undefined) { if (typeof b.text !== 'string') return { error: 'The question has to be text.' }; patch.text = b.text.trim().slice(0, 300); }
  if (b.choices !== undefined) {
    if (!Array.isArray(b.choices) || b.choices.length !== CHOICES || b.choices.some((c) => typeof c !== 'string')) return { error: 'A question has exactly four answers.' };
    patch.choices = (b.choices as string[]).map((c) => c.trim().slice(0, 120));
  }
  if (b.correct !== undefined) { const n = Math.round(Number(b.correct)); if (!Number.isFinite(n) || n < 0 || n >= CHOICES) return { error: 'The right answer is one of the four.' }; patch.correct = n; }
  if (b.secs !== undefined) { const n = Math.round(Number(b.secs)); if (!Number.isFinite(n) || n < MIN_SECS || n > MAX_SECS) return { error: `The time is between ${MIN_SECS} and ${MAX_SECS} seconds.` }; patch.secs = n; }
  return { patch };
}

// Add one question to the pool (blank, or with what is given), or several at once with `rows`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const quiz = await findQuiz(auth.svc, (await params).id);
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const list: Record<string, unknown>[] = Array.isArray(b.rows) ? b.rows.slice(0, 200) : [b];
  const { data: last } = await auth.svc.from('trivia_questions').select('sort').eq('quiz_id', quiz.id).order('sort', { ascending: false }).limit(1);
  const have = await auth.svc.from('trivia_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quiz.id);
  if ((have.count ?? 0) + list.length > MAX_QUESTIONS) return NextResponse.json({ error: `A pool holds up to ${MAX_QUESTIONS} questions.` }, { status: 400 });
  let sort = ((last?.[0]?.sort as number | undefined) ?? -1) + 1;
  const rows = [];
  for (const item of list) {
    const c = clean(item);
    if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
    rows.push({ quiz_id: quiz.id, sort: sort++, text: '', choices: ['', '', '', ''], correct: 0, secs: DEFAULT_SECS, ...c.patch });
  }
  const { data, error } = await auth.svc.from('trivia_questions').insert(rows).select(COLS);
  if (error) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  return NextResponse.json({ questions: data }, { status: 201 });
}

// Change a question.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const quiz = await findQuiz(auth.svc, (await params).id);
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const c = clean(b);
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const { data, error } = await auth.svc.from('trivia_questions').update({ ...c.patch, updated_at: new Date().toISOString() }).eq('id', b.id).eq('quiz_id', quiz.id).select(COLS).maybeSingle();
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'That question is gone.' }, { status: 404 });
  return NextResponse.json({ question: data });
}

// Remove questions from the pool (games already drawn keep their own copy).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const quiz = await findQuiz(auth.svc, (await params).id);
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 500);
  if (!ids.length) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await auth.svc.from('trivia_questions').delete().eq('quiz_id', quiz.id).in('id', ids);
  return NextResponse.json({ ok: true });
}
