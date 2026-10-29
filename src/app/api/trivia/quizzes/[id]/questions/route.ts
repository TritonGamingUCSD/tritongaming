import { NextResponse } from 'next/server';
import { authorizeTrivia, findQuiz, quizGate, UUID } from '@/lib/trivia/server';
import { removeImages } from '../image/route';
import { CHOICES, DEFAULT_SECS, suggestSecs } from '@/lib/trivia/game';

export const dynamic = 'force-dynamic';
const COLS = 'id, sort, category, image, text, choices, correct';
const MAX_QUESTIONS = 1000;

// What a client may set on a question, checked; anything not given is left alone. The time is not one of them: it is worked out from the wording.
function clean(b: Record<string, unknown>): { patch: Record<string, unknown> } | { error: string } {
  const patch: Record<string, unknown> = {};
  if (b.text !== undefined) {
    if (typeof b.text !== 'string') return { error: 'The question has to be text.' };
    patch.text = b.text.trim().slice(0, 300);
  }
  if (b.choices !== undefined) {
    if (!Array.isArray(b.choices) || b.choices.length !== CHOICES || b.choices.some((c) => typeof c !== 'string')) return { error: 'A question has exactly four answers.' };
    patch.choices = (b.choices as string[]).map((c) => c.trim().slice(0, 120));
  }
  if (b.category !== undefined) {
    if (typeof b.category !== 'string') return { error: 'The category has to be text.' };
    patch.category = b.category.trim().replace(/\s+/g, ' ').slice(0, 40);
  }
  if (b.correct !== undefined) {
    const n = Math.round(Number(b.correct));
    if (!Number.isFinite(n) || n < 0 || n >= CHOICES) return { error: 'The right answer is one of the four.' };
    patch.correct = n;
  }
  return { patch };
}

// A category typed in different capitals than one the quiz already has takes the existing spelling, so "gaming" and "Gaming" are one category.
async function snapCategories(svc: Parameters<typeof findQuiz>[0], quizId: string, patches: Record<string, unknown>[]) {
  if (!patches.some((p) => typeof p.category === 'string' && p.category)) return;
  const { data } = await svc.from('trivia_questions').select('category').eq('quiz_id', quizId).neq('category', '').limit(1000);
  const known = new Map<string, string>();
  for (const r of data ?? []) {
    const c = r.category as string;
    if (!known.has(c.toLowerCase())) known.set(c.toLowerCase(), c);
  }
  for (const p of patches)
    if (typeof p.category === 'string' && p.category) {
      const k = p.category.toLowerCase();
      if (known.has(k)) p.category = known.get(k);
      else known.set(k, p.category);
    }
}

// Add one question to the pool (blank, or with what is given), or several at once with `rows`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const quiz = await findQuiz(auth.svc, (await params).id);
  if (!quiz) return NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 });
  {
    const lock = await quizGate(auth, quiz);
    if (lock) return lock;
  }
  const b = await request.json().catch(() => ({}));
  const list: Record<string, unknown>[] = Array.isArray(b.rows) ? b.rows.slice(0, 200) : [b];
  const { data: last } = await auth.svc.from('trivia_questions').select('sort').eq('quiz_id', quiz.id).order('sort', { ascending: false }).limit(1);
  const have = await auth.svc.from('trivia_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quiz.id);
  if ((have.count ?? 0) + list.length > MAX_QUESTIONS) return NextResponse.json({ error: `A pool holds up to ${MAX_QUESTIONS} questions.` }, { status: 400 });
  const cleaned = list.map((item) => clean(item));
  for (const c of cleaned) if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
  await snapCategories(
    auth.svc,
    quiz.id,
    cleaned.map((c) => ('patch' in c ? c.patch : {})),
  );
  let sort = ((last?.[0]?.sort as number | undefined) ?? -1) + 1;
  const rows = [];
  for (const c of cleaned) {
    if ('error' in c) continue;
    const row = { quiz_id: quiz.id, sort: sort++, category: '', image: '', text: '', choices: ['', '', '', ''], correct: 0, secs: DEFAULT_SECS, ...c.patch } as {
      text: string;
      choices: string[];
      secs: number;
    };
    row.secs = suggestSecs(row); // the time is always automatic
    rows.push(row);
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
  {
    const lock = await quizGate(auth, quiz);
    if (lock) return lock;
  }
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const c = clean(b);
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 });
  await snapCategories(auth.svc, quiz.id, [c.patch]);
  // The time follows the wording: it is worked out again whenever the text or an answer changes.
  if (c.patch.text !== undefined || c.patch.choices !== undefined) {
    const { data: cur } = await auth.svc.from('trivia_questions').select('text, choices').eq('id', b.id).eq('quiz_id', quiz.id).maybeSingle();
    if (cur)
      c.patch.secs = suggestSecs({
        text: (c.patch.text as string | undefined) ?? (cur.text as string),
        choices: (c.patch.choices as string[] | undefined) ?? (cur.choices as string[]),
      });
  }
  const { data, error } = await auth.svc
    .from('trivia_questions')
    .update({ ...c.patch, updated_at: new Date().toISOString() })
    .eq('id', b.id)
    .eq('quiz_id', quiz.id)
    .select(COLS)
    .maybeSingle();
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
  {
    const lock = await quizGate(auth, quiz);
    if (lock) return lock;
  }
  const b = await request.json().catch(() => ({}));
  const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 500);
  if (!ids.length) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: gone } = await auth.svc.from('trivia_questions').select('image').eq('quiz_id', quiz.id).in('id', ids);
  await auth.svc.from('trivia_questions').delete().eq('quiz_id', quiz.id).in('id', ids);
  await removeImages(
    auth.svc,
    (gone ?? []).map((r) => r.image as string),
  ); // games already drawn keep the address, but their question is over
  return NextResponse.json({ ok: true });
}
