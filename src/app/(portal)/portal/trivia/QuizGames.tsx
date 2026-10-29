'use client';

import { formatPacificDateTime } from '@/lib/core/timezone';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { call } from './api';
import { LETTERS, fmtScore } from './shapes';
import styles from './trivia.module.css';

interface GameItem {
  code: string;
  status: string;
  created_at: string;
  quiz: string;
  quiz_slug: string;
  questions: number;
  players: number;
  winners: { rank: number; name: string }[];
}
interface Results {
  standings: { id: string; name: string; score: number; time_ms: number }[];
  questions: { text: string; choices: string[]; correct: number; counts: number[] }[];
}

const when = (iso: string) => formatPacificDateTime(iso);
const STATUS: Record<string, string> = { lobby: 'Waiting for players', question: 'Running', reveal: 'Running', done: 'Finished' };

// One quiz's games: the ones still running (to get back to the host screen) and the finished ones with their top three. Opening one shows the full results (its own page, see GameResults).
export function QuizGames({ quiz, onOpen, onHost, reload }: { quiz: string; onOpen: (code: string) => void; onHost: (code: string) => void; reload: number }) {
  const [games, setGames] = useState<GameItem[] | null>(null);
  const [more, setMore] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await call<{ games: GameItem[]; more: boolean }>('GET', `/api/trivia/games?quiz=${encodeURIComponent(quiz)}`);
    if (r.ok) {
      setGames(r.data.games);
      setMore(r.data.more);
    } else setError(r.error);
  }, [quiz]);
  // The next page of older games: asked for from the date of the last one shown.
  const loadMore = async () => {
    const last = games?.[games.length - 1];
    if (!last || paging) return;
    setPaging(true);
    const r = await call<{ games: GameItem[]; more: boolean }>('GET', `/api/trivia/games?quiz=${encodeURIComponent(quiz)}&before=${encodeURIComponent(last.created_at)}`);
    setPaging(false);
    if (r.ok) {
      setGames((l) => [...(l ?? []), ...r.data.games.filter((g) => !(l ?? []).some((x) => x.code === g.code))]);
      setMore(r.data.more);
    } else setError(r.error);
  };
  useEffect(() => {
    void load();
  }, [load, reload]);
  const remove = async (g: GameItem) => {
    if (
      !(await confirmHold({
        title: 'Delete this game?',
        message: `${when(g.created_at)}. Its results are deleted, and its top 3 are free to play this quiz again.`,
        confirmLabel: 'Hold to delete',
      }))
    )
      return;
    const r = await call('DELETE', `/api/trivia/games/${g.code}`);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    showToast('Game deleted');
    setGames((l) => (l ?? []).filter((x) => x.code !== g.code));
  };
  return (
    <div className={styles.tab}>
      <h2 className={styles.sectionTitle}>Games</h2>
      {error && (
        <div role="alert" onClick={() => setError('')}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {!games ? (
        error ? null : (
          <Loading variant="inline" label="Loading…" />
        )
      ) : games.length === 0 ? (
        <div className={styles.empty}>
          <p>No games of this quiz yet. Host one with the button above.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {games.map((g) => (
            <div key={g.code} className={styles.item}>
              <div className={styles.itemMain}>
                <b>{when(g.created_at)}</b>
                <span className={styles.muted}>
                  {g.players} {g.players === 1 ? 'player' : 'players'} · {g.questions} questions
                </span>
                {g.winners.length > 0 && <span className={styles.muted}>{g.winners.map((w) => `${w.rank}. ${w.name}`).join('   ')}</span>}
              </div>
              <span className={`${styles.badge} ${g.status === 'done' ? styles.neutral : styles.good}`}>{STATUS[g.status] ?? g.status}</span>
              {g.status === 'done' ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => onOpen(g.code)}>
                    Results
                  </Button>
                  <button type="button" className={styles.iconLink} aria-label={`Delete the game of ${when(g.created_at)}`} onClick={() => void remove(g)}>
                    <Trash2 size={15} />
                  </button>
                </>
              ) : (
                <Button size="sm" onClick={() => onHost(g.code)}>
                  Open Host Screen
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {more && (
        <div>
          <Button variant="secondary" loading={paging} onClick={() => void loadMore()}>
            Load More Games
          </Button>
        </div>
      )}
    </div>
  );
}

/** Games still running, across every quiz, for the strip at the top of the Quizzes list. */
export function LiveGames({ onHost }: { onHost: (code: string) => void }) {
  const [games, setGames] = useState<GameItem[]>([]);
  useEffect(() => {
    let on = true;
    void call<{ games: GameItem[] }>('GET', '/api/trivia/games?live=1').then((r) => {
      if (on && r.ok) setGames(r.data.games);
    });
    return () => {
      on = false;
    };
  }, []);
  const close = async (g: GameItem) => {
    if (
      g.players > 0 &&
      !(await confirmHold({ title: 'Close this lobby?', message: `${g.players} ${g.players === 1 ? 'player is' : 'players are'} waiting in it.`, confirmLabel: 'Hold to close' }))
    )
      return;
    const r = await call('DELETE', `/api/trivia/games/${g.code}`);
    if (r.ok) setGames((l) => l.filter((x) => x.code !== g.code));
  };
  if (!games.length) return null;
  return (
    <div className={styles.liveStrip} role="status">
      <span className={styles.cardKicker}>Live now</span>
      {games.map((g) => (
        <div key={g.code} className={styles.row}>
          <b>{g.quiz}</b>
          <span className={styles.muted}>
            {g.players} {g.players === 1 ? 'player' : 'players'} · {STATUS[g.status]}
          </span>
          <span className={styles.spacer} />
          <Button size="sm" onClick={() => onHost(g.code)}>
            Open Host Screen
          </Button>
          {g.status === 'lobby' && (
            <Button size="sm" variant="secondary" onClick={() => void close(g)}>
              Close
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function GameResults({ code, onBack }: { code: string; onBack: () => void }) {
  const [res, setRes] = useState<Results | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void call<{ results: Results }>('GET', `/api/trivia/games/${code}?results=1`).then((r) => {
      if (!alive) return;
      if (r.ok) setRes(r.data.results);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [code]);
  return (
    <div className={styles.tab}>
      <div className={styles.row}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> Back To The Quiz
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!res ? (
        error ? null : (
          <Loading variant="inline" label="Loading…" />
        )
      ) : (
        <>
          <h3 className={styles.sectionTitle}>Leaderboard</h3>
          {res.standings.length === 0 ? (
            <div className={styles.empty}>
              <p>Nobody scored.</p>
            </div>
          ) : (
            <div className={styles.list}>
              {res.standings.map((p, i) => (
                <div key={p.id} className={styles.item}>
                  <span className={`${styles.rankNum} ${i === 0 ? styles.rankNum1 : ''}`}>{i + 1}</span>
                  <div className={styles.itemMain}>
                    <b>{p.name}</b>
                  </div>
                  <span className={styles.muted}>{(p.time_ms / 1000).toFixed(1)}s on right answers</span>
                  <b>{fmtScore(p.score)}</b>
                </div>
              ))}
            </div>
          )}
          <h3 className={styles.sectionTitle}>Questions</h3>
          <div className={styles.list}>
            {res.questions.map((q, n) => {
              const total = q.counts.reduce((a, b) => a + b, 0);
              const pct = total ? Math.round((q.counts[q.correct] / total) * 100) : 0;
              return (
                <div key={n} className={styles.item} style={{ alignItems: 'flex-start' }}>
                  <span className={styles.rankNum}>{n + 1}</span>
                  <div className={styles.itemMain}>
                    <b>{q.text}</b>
                    <span className={styles.muted}>{total ? `${pct}% got it right (${q.counts[q.correct]} of ${total})` : 'Nobody answered'}</span>
                    <div className={styles.cardMeta}>
                      {q.choices.map((c, i) => (
                        <span key={i} className={`${styles.badge} ${i === q.correct ? styles.good : styles.neutral}`}>
                          {LETTERS[i]}. {c} · {q.counts[i]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
