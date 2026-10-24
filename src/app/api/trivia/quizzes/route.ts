import { NextResponse } from 'next/server';
import { authorizeTrivia } from '@/lib/trivia/server';
import { isAskable } from '@/lib/trivia/game';
import { slugify } from '@/lib/core/slug';

export const dynamic = 'force-dynamic';

// Every quiz with how many questions are in its pool and how many of them are finished (the ones a game can draw).
export async function GET() {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const [quizzes, questions] = await Promise.all([
    auth.svc.from('trivia_quizzes').select('id, slug, name, per_game, created_at').order('created_at', { ascending: false }).limit(500),
    auth.svc.from('trivia_questions').select('quiz_id, text, choices, correct').limit(20000),
  ]);
  const total = new Map<string, number>(), ready = new Map<string, number>();
  for (const q of (questions.data ?? []) as { quiz_id: string; text: string; choices: string[]; correct: number }[]) {
    total.set(q.quiz_id, (total.get(q.quiz_id) ?? 0) + 1);
    if (isAskable(q)) ready.set(q.quiz_id, (ready.get(q.quiz_id) ?? 0) + 1);
  }
  return NextResponse.json({ quizzes: (quizzes.data ?? []).map((q) => ({ ...q, questions: total.get(q.id as string) ?? 0, ready: ready.get(q.id as string) ?? 0 })) });
}

export async function POST(request: Request) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : '';
  if (!name) return NextResponse.json({ error: 'Give the quiz a name.' }, { status: 400 });
  const base = slugify(name).slice(0, 50) || 'quiz';
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await auth.svc.from('trivia_quizzes').insert({ slug, name, created_by: auth.user.id }).select('id, slug, name, per_game, created_at').single();
    if (data) return NextResponse.json({ quiz: { ...data, questions: 0, ready: 0 } }, { status: 201 });
    if (error?.code !== '23505') return NextResponse.json({ error: 'Couldn’t make that quiz.' }, { status: 500 });
  }
  return NextResponse.json({ error: 'There is already a quiz with that name.' }, { status: 409 });
}
