import { NextResponse } from 'next/server';
import { authorizeTrivia, lockedQuizIds, QUIZ_COLUMNS } from '@/lib/trivia/server';
import { isAskable } from '@/lib/trivia/game';
import { slugify } from '@/lib/core/slug';

export const dynamic = 'force-dynamic';

// Every quiz with how many questions are in its pool and how many of them are finished (the ones a game can draw).
export async function GET() {
  const auth = await authorizeTrivia('host');
  if (auth.error) return auth.error;
  const [quizzes, questions, locked, played] = await Promise.all([
    auth.svc.from('trivia_quizzes').select(QUIZ_COLUMNS).order('created_at', { ascending: false }).limit(500),
    auth.svc.from('trivia_questions').select('quiz_id, category, text, choices, correct').limit(20000),
    lockedQuizIds(auth),
    auth.svc.from('trivia_games').select('quiz_id, created_at').neq('status', 'lobby').order('created_at', { ascending: false }).limit(5000),
  ]);
  const games = new Map<string, { n: number; last: string }>(); // how many games each quiz has had, and when the latest was
  for (const g of (played.data ?? []) as { quiz_id: string; created_at: string }[]) {
    const c = games.get(g.quiz_id);
    if (c) c.n++;
    else games.set(g.quiz_id, { n: 1, last: g.created_at });
  }
  const total = new Map<string, number>(),
    ready = new Map<string, number>();
  for (const q of (questions.data ?? []) as { quiz_id: string; category: string; text: string; choices: string[]; correct: number }[]) {
    total.set(q.quiz_id, (total.get(q.quiz_id) ?? 0) + 1);
    if (isAskable(q)) ready.set(q.quiz_id, (ready.get(q.quiz_id) ?? 0) + 1);
  }
  // A quiz shared with other officers shows to this one as its name and a lock, nothing else.
  const lock = new Set(locked);
  return NextResponse.json({
    quizzes: (quizzes.data ?? []).map(({ created_by: _by, ...q }) =>
      lock.has(q.id as string)
        ? {
            id: q.id,
            slug: q.slug,
            name: q.name,
            per_game: 0,
            block_winners: false,
            restricted: true,
            open_to_guests: false,
            locked: true,
            questions: 0,
            ready: 0,
            games: 0,
            last_played: null,
            created_at: q.created_at,
          }
        : {
            ...q,
            locked: false,
            questions: total.get(q.id as string) ?? 0,
            ready: ready.get(q.id as string) ?? 0,
            games: games.get(q.id as string)?.n ?? 0,
            last_played: games.get(q.id as string)?.last ?? null,
          },
    ),
  });
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
    const { data, error } = await auth.svc.from('trivia_quizzes').insert({ slug, name, created_by: auth.user.id }).select(QUIZ_COLUMNS).single();
    if (data) {
      const { created_by: _by, ...quiz } = data as typeof data & { created_by: string | null };
      return NextResponse.json({ quiz: { ...quiz, locked: false, questions: 0, ready: 0, games: 0, last_played: null } }, { status: 201 });
    }
    if (error?.code !== '23505') return NextResponse.json({ error: 'Couldn’t make that quiz.' }, { status: 500 });
  }
  return NextResponse.json({ error: 'There is already a quiz with that name.' }, { status: 409 });
}
