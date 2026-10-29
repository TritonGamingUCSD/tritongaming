'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, Pencil, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { Field, Input } from '@/components/ui/Field';
import { call } from './api';
import { LiveGames } from './QuizGames';
import type { QuizRow } from '@/lib/trivia/types';
import styles from './trivia.module.css';

// The quizzes. Each is a pool of questions; hosting it draws a fresh random set from the pool.
export async function startGame(quiz: string): Promise<{ code: string } | { error: string }> {
  const r = await call<{ code: string }>('POST', '/api/trivia/games', { quiz });
  return r.ok ? { code: r.data.code } : { error: r.error };
}

export default function QuizzesTab({ onOpen, onHost }: { onOpen: (slug: string, view?: 'questions' | 'games') => void; onHost: (code: string) => void }) {
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const r = await call<{ quizzes: QuizRow[] }>('GET', '/api/trivia/quizzes');
    if (r.ok) setQuizzes(r.data.quizzes);
    else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy('new');
    setError('');
    const r = await call<{ quiz: QuizRow }>('POST', '/api/trivia/quizzes', { name });
    setBusy('');
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setName('');
    onOpen(r.data.quiz.slug);
  };
  const host = async (q: QuizRow) => {
    setBusy(q.id);
    setError('');
    const r = await startGame(q.slug);
    setBusy('');
    if ('error' in r) setError(r.error);
    else onHost(r.code);
  };

  return (
    <div className={styles.tab}>
      <div className={styles.newRow}>
        <Field label="New Quiz">
          <Input
            value={name}
            maxLength={80}
            placeholder="Name of the quiz"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create();
            }}
          />
        </Field>
        <Button loading={busy === 'new'} disabled={!name.trim()} onClick={() => void create()}>
          <Plus size={15} aria-hidden="true" /> Add Quiz
        </Button>
      </div>
      <LiveGames onHost={onHost} />
      {error && (
        <div role="alert" onClick={() => setError('')}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {!quizzes ? (
        error ? null : (
          <Loading variant="inline" label="Loading…" />
        )
      ) : quizzes.length === 0 ? (
        <div className={styles.empty}>
          <p>No quizzes yet. Name one above, then add its questions.</p>
        </div>
      ) : (
        <div className={styles.cards}>
          {quizzes.map((q) =>
            q.locked ? (
              <div key={q.id} className={styles.card}>
                <span className={styles.cardKicker}>
                  <Lock size={11} aria-hidden="true" /> Private
                </span>
                <h3 className={styles.cardTitle}>{q.name}</h3>
                <p className={styles.muted}>Shared with only some officers. Ask its creator or an Admin for access.</p>
              </div>
            ) : (
              <div
                key={q.id}
                className={`${styles.card} ${styles.cardLink}`}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button, a, input')) onOpen(q.slug);
                }}
              >
                <span className={styles.cardKicker}>Quiz</span>
                <h3 className={styles.cardTitle}>
                  <button type="button" onClick={() => onOpen(q.slug)}>
                    {q.name}
                  </button>
                </h3>
                <div className={styles.cardMeta}>
                  {q.open_to_guests && <span className={`${styles.badge} ${styles.neutral}`}>Guests welcome</span>}
                  {q.restricted && (
                    <span className={`${styles.badge} ${styles.neutral}`}>
                      <Lock size={11} aria-hidden="true" /> Private
                    </span>
                  )}
                  <span className={`${styles.badge} ${styles.neutral}`}>
                    {q.questions} {q.questions === 1 ? 'question' : 'questions'} in the pool
                  </span>
                  <span className={`${styles.badge} ${styles.neutral}`}>{Math.min(q.per_game, q.ready || q.per_game)} per game</span>
                  <span className={`${styles.badge} ${styles.neutral}`}>
                    {!q.games
                      ? 'Not played yet'
                      : `Played ${q.games === 1 ? 'once' : `${q.games} times`}${q.last_played ? `, last ${new Date(q.last_played).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}` : ''}`}
                  </span>
                  {q.ready < q.questions && <span className={`${styles.badge} ${styles.bad}`}>{q.questions - q.ready} unfinished</span>}
                </div>
                <div className={styles.cardActions}>
                  <Button size="sm" disabled={!q.ready} loading={busy === q.id} onClick={() => void host(q)}>
                    Host Game
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onOpen(q.slug)}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onOpen(q.slug, 'games')}>
                    History
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
