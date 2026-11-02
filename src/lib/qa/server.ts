import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '@/lib/core/slug';
import { CODE, UUID } from '@/lib/polls/server';
import type { QaSessionStatus, QaStatus, QuestionInfo } from '@/lib/qa/rank';

export const QA_COLUMNS = 'id, slug, name, status, code, spotlight_id, created_by, created_at, opened_at, closed_at';

export interface QaSessionRow {
  id: string;
  slug: string;
  name: string;
  status: QaSessionStatus;
  code: string | null;
  spotlight_id: string | null;
  created_by: string | null;
  created_at: string;
  opened_at: string | null;
  closed_at: string | null;
}

/** A session by its address word, its id or its 6-digit code. */
export async function loadSession(svc: SupabaseClient, key: string): Promise<QaSessionRow | null> {
  const col = UUID.test(key) ? 'id' : CODE.test(key) ? 'code' : 'slug';
  const { data, error } = await svc.from('qa_sessions').select(QA_COLUMNS).eq(col, key).maybeSingle();
  if (error) throw new Error(`Q&A read failed: ${error.message}`);
  return (data as QaSessionRow | null) ?? null;
}

/** Every question of a session with how many likes it has, and the ids the given person has liked. */
export async function loadQuestions(
  svc: SupabaseClient,
  sessionId: string,
  me?: string,
): Promise<{ questions: (QuestionInfo & { user_id: string | null })[]; liked: Set<string> }> {
  const { data } = await svc.from('qa_questions').select('id, body, author, status, created_at, user_id').eq('session_id', sessionId).order('created_at').limit(2000);
  const rows = (data ?? []) as { id: string; body: string; author: string; status: QaStatus; created_at: string; user_id: string | null }[];
  const counts = new Map<string, number>();
  const liked = new Set<string>();
  const ids = rows.map((q) => q.id);
  for (let from = 0; ids.length; from += 1000) {
    const { data: likes } = await svc
      .from('qa_likes')
      .select('question_id, user_id')
      .in('question_id', ids)
      .range(from, from + 999);
    for (const l of (likes ?? []) as { question_id: string; user_id: string }[]) {
      counts.set(l.question_id, (counts.get(l.question_id) ?? 0) + 1);
      if (l.user_id === me) liked.add(l.question_id);
    }
    if ((likes ?? []).length < 1000) break;
  }
  return { questions: rows.map((q) => ({ ...q, likes: counts.get(q.id) ?? 0 })), liked };
}

/** An address word for a new session from its name (a number is added when it is taken). */
export async function freshQaSlug(svc: SupabaseClient, name: string): Promise<string> {
  let base = slugify(name).slice(0, 50) || 'qa';
  if (base === 'host') base = 'host-qa'; // (/portal/qa/host/<session> is the big screen)
  for (let i = 0; i < 8; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { count } = await svc.from('qa_sessions').select('id', { count: 'exact', head: true }).eq('slug', slug);
    if (!count) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** What the host's screens work with: the session and every question (waiting, shown, hidden and answered) with its likes. */
export async function hostView(svc: SupabaseClient, session: QaSessionRow) {
  const { questions } = await loadQuestions(svc, session.id);
  return { session, questions: questions.map(({ user_id: _u, ...q }) => q) };
}
