'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { Field, Input } from '@/components/ui/Field';
import { call } from './api';
import type { QuizRow } from '@/lib/trivia/types';
import styles from './trivia.module.css';

// The quizzes. Each is a pool of questions; hosting it draws a fresh random set from the pool.
export async function startGame(quiz: string, practice: boolean): Promise<{ code: string } | { error: string }> {
  const r = await call<{ code: string }>('POST', '/api/trivia/games', { quiz, practice });
  return r.ok ? { code: r.data.code } : { error: r.error };
}

export default function QuizzesTab({ onOpen, onHost }: { onOpen: (slug: string) => void; onHost: (code: string) => void }) {
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const r = await call<{ quizzes: QuizRow[] }>('GET', '/api/trivia/quizzes');
    if (r.ok) setQuizzes(r.data.quizzes); else setError(r.error);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy('new'); setError('');
    const r = await call<{ quiz: QuizRow }>('POST', '/api/trivia/quizzes', { name });
    setBusy('');
    if (!r.ok) { setError(r.error); return; }
    setName('');
    onOpen(r.data.quiz.slug);
  };
  const host = async (q: QuizRow, practice: boolean) => {
    setBusy(`${q.id}${practice}`); setError('');
    const r = await startGame(q.slug, practice);
    setBusy('');
    if ('error' in r) setError(r.error); else onHost(r.code);
  };

  return (
    <div className={styles.tab}>
      <div className={styles.newRow}>
        <Field label="New Quiz"><Input value={name} maxLength={80} placeholder="Name of the quiz" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} /></Field>
        <Button loading={busy === 'new'} disabled={!name.trim()} onClick={() => void create()}><Plus size={15} aria-hidden="true" /> Add Quiz</Button>
      </div>
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!quizzes ? (error ? null : <Loading variant="inline" label="Loading…" />) : quizzes.length === 0 ? (
        <div className={styles.empty}><p>No quizzes yet. Name one above, then add its questions.</p></div>
      ) : (
        <div className={styles.cards}>
          {quizzes.map((q) => (
            <div key={q.id} className={styles.card}>
              <span className={styles.cardKicker}>Quiz</span>
              <h3 className={styles.cardTitle}><button type="button" onClick={() => onOpen(q.slug)}>{q.name}</button></h3>
              <div className={styles.cardMeta}>
                <span className={`${styles.badge} ${styles.neutral}`}>{q.questions} {q.questions === 1 ? 'question' : 'questions'} in the pool</span>
                <span className={`${styles.badge} ${styles.neutral}`}>{Math.min(q.per_game, q.ready || q.per_game)} per game</span>
                {q.ready < q.questions && <span className={`${styles.badge} ${styles.bad}`}>{q.questions - q.ready} unfinished</span>}
              </div>
              <div className={styles.cardActions}>
                <Button size="sm" disabled={!q.ready} loading={busy === `${q.id}false`} onClick={() => void host(q, false)}>Host Game</Button>
                <Button size="sm" variant="secondary" disabled={!q.ready} loading={busy === `${q.id}true`} onClick={() => void host(q, true)}>Practice</Button>
                <Button size="sm" variant="ghost" onClick={() => onOpen(q.slug)}>Questions</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
