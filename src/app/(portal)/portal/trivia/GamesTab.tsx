'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { call } from './api';
import { ansClass, LETTERS, fmtScore } from './shapes';
import styles from './trivia.module.css';

interface GameItem { code: string; status: string; practice: boolean; created_at: string; quiz: string; quiz_slug: string; questions: number; players: number; winners: { rank: number; name: string }[] }
interface Results { standings: { id: string; name: string; score: number; time_ms: number }[]; questions: { text: string; choices: string[]; correct: number; counts: number[] }[] }

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
const STATUS: Record<string, string> = { lobby: 'Waiting for players', question: 'Running', reveal: 'Running', done: 'Finished' };

// Every game: the ones still running (to get back to the host screen) and the finished ones with their top three. Opening one shows the full results.
export default function GamesTab({ code, onOpen, onHost, onBack }: { code: string | null; onOpen: (code: string | null) => void; onHost: (code: string) => void; onBack: () => void }) {
  const [games, setGames] = useState<GameItem[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await call<{ games: GameItem[] }>('GET', '/api/trivia/games');
    if (r.ok) setGames(r.data.games); else setError(r.error);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const remove = async (g: GameItem) => {
    if (!(await confirmHold({ title: 'Delete this game?', message: `${g.quiz}, ${when(g.created_at)}. Its results are deleted, and its top 3 are free to play this quiz again.`, confirmLabel: 'Hold to delete' }))) return;
    const r = await call('DELETE', `/api/trivia/games/${g.code}`);
    if (!r.ok) { setError(r.error); return; }
    showToast('Game deleted');
    setGames((l) => (l ?? []).filter((x) => x.code !== g.code));
    if (code) onBack();
  };

  if (code) return <GameResults code={code} game={games?.find((g) => g.code === code)} onBack={onBack} onRemove={remove} />;
  return (
    <div className={styles.tab}>
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}
      {!games ? (error ? null : <Loading variant="inline" label="Loading…" />) : games.length === 0 ? <div className={styles.empty}><p>No games yet. Host one from Quizzes.</p></div> : (
        <div className={styles.list}>
          {games.map((g) => (
            <div key={g.code} className={styles.item}>
              <div className={styles.itemMain}>
                <b>{g.quiz}</b>
                <span className={styles.muted}>{when(g.created_at)} · {g.players} {g.players === 1 ? 'player' : 'players'} · {g.questions} questions{g.practice ? ' · Practice' : ''}</span>
                {g.winners.length > 0 && <span className={styles.muted}>{g.winners.map((w) => `${w.rank}. ${w.name}`).join('   ')}</span>}
              </div>
              <span className={`${styles.badge} ${g.status === 'done' ? styles.neutral : styles.good}`}>{STATUS[g.status] ?? g.status}</span>
              {g.status === 'done'
                ? <Button size="sm" variant="secondary" onClick={() => onOpen(g.code)}>Results</Button>
                : <Button size="sm" onClick={() => onHost(g.code)}>Open Host Screen</Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GameResults({ code, game, onBack, onRemove }: { code: string; game?: GameItem; onBack: () => void; onRemove: (g: GameItem) => Promise<void> }) {
  const [res, setRes] = useState<Results | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void call<{ results: Results }>('GET', `/api/trivia/games/${code}?results=1`).then((r) => { if (!alive) return; if (r.ok) setRes(r.data.results); else setError(r.error); });
    return () => { alive = false; };
  }, [code]);
  return (
    <div className={styles.tab}>
      <div className={styles.row}>
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Games</Button>
        <span className={styles.spacer} />
        {game && <Button size="sm" variant="danger" onClick={() => void onRemove(game)}><Trash2 size={14} aria-hidden="true" /> Delete Game</Button>}
      </div>
      {game && <h2 className={styles.sectionTitle}>{game.quiz} <span className={styles.dim}>· {when(game.created_at)}</span></h2>}
      {error && <Notice tone="error">{error}</Notice>}
      {!res ? (error ? null : <Loading variant="inline" label="Loading…" />) : (
        <>
          <h3 className={styles.sectionTitle}>Leaderboard</h3>
          {res.standings.length === 0 ? <div className={styles.empty}><p>Nobody scored.</p></div> : (
            <div className={styles.list}>
              {res.standings.map((p, i) => (
                <div key={p.id} className={styles.item}><span className={`${styles.rankNum} ${i === 0 ? styles.rankNum1 : ''}`}>{i + 1}</span><div className={styles.itemMain}><b>{p.name}</b></div><span className={styles.muted}>{(p.time_ms / 1000).toFixed(1)}s on right answers</span><b>{fmtScore(p.score)}</b></div>
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
                    <div className={styles.cardMeta}>{q.choices.map((c, i) => <span key={i} className={`${styles.badge} ${i === q.correct ? styles.good : styles.neutral}`}>{LETTERS[i]}. {c} · {q.counts[i]}</span>)}</div>
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
void ansClass;
