'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, UserMinus, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import { Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { call } from './api';
import { useCountdown, useGame } from './useGame';
import { Stage, Confetti, Letter, Shape, Tape, ansClass, fmtScore } from './shapes';
import TriviaQr from './TriviaQr';
import styles from './trivia.module.css';

// Running a game: the big screen, in the navy show look. The lobby is one ticket with the QR code and the join code; each question shows the clock and how many have answered; then the answer, how many
// chose what and the top five; at the end the podium. Everything is a button press here, the server keeps the game; reloading this page picks it up where it was.
export default function HostGame({ code, onLeave, onResults }: { code: string; onLeave: () => void; onResults: () => void }) {
  const { state, host, error, gone, serverNow, reload } = useGame(code, 'host');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/portal/trivia/play/${code}`;
  const q = state?.question;
  const left = useCountdown(state?.status === 'question' ? q?.endsAt : null, serverNow);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true); setProblem('');
    const r = await call('POST', `/api/trivia/games/${code}`, body);
    setBusy(false);
    if (!r.ok) { setProblem(r.error); void reload(); return false; }
    return true;
  };

  // The question closes by itself when the clock runs out (a moment later, so answers still on their way count) or as soon as everybody in has answered.
  const closing = useRef('');
  const status = state?.status, current = state?.current ?? -1;
  const everyone = !!state && state.players > 0 && (state.answered ?? 0) >= state.players;
  useEffect(() => {
    if (status !== 'question' || !q) return;
    const key = `${state?.gameId}:${current}`;
    const wait = everyone ? 700 : Math.max(0, q.endsAt - serverNow()) + 1300;
    const t = setTimeout(() => { if (closing.current !== key) { closing.current = key; void call('POST', `/api/trivia/games/${code}`, { action: 'reveal' }).then(() => reload()); } }, wait);
    return () => clearTimeout(t);
  }, [status, current, everyone, q, code, serverNow, reload, state?.gameId]);

  const frame = (body: React.ReactNode, foot?: React.ReactNode) => (
    <Stage><div className={styles.stage} role="dialog" aria-label="Hosting Trivia">
      <div className={styles.stageBar}>
        <button type="button" className={styles.stageBack} onClick={onLeave} aria-label="Leave this screen (the game keeps going)"><ArrowLeft size={18} /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logo} src="/logos/tg_logo.png" alt="" />
        <b>{state?.quiz || 'Trivia'}</b>
        {state?.practice && <span className={`${styles.badge} ${styles.good}`}>Practice</span>}
        <span className={`${styles.badge} ${styles.neutral} ${styles.spacer}`}>{state?.players ?? 0} {state?.players === 1 ? 'player' : 'players'}</span>
        {state && state.status !== 'done' && state.status !== 'lobby' && <Button size="sm" variant="secondary" onClick={async () => { if (await confirmHold({ title: 'End this game now?', message: 'The podium is shown with the scores so far.', confirmLabel: 'Hold to end' })) await act({ action: 'end' }); }}>End Game</Button>}
      </div>
      <div className={styles.stageBody}>{body}{problem && <p role="alert" className={styles.needs} style={{ textAlign: 'center' }}>{problem}</p>}{foot}</div>
    </div></Stage>
  );

  if (gone) return frame(<div className={styles.center} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}><p className={styles.big}>That game is gone.</p><p className={styles.mid}>{error}</p><Button onClick={onLeave}>Back</Button></div>);
  if (!state) return frame(error ? <p className={styles.mid} role="alert">{error}</p> : <Loading variant="inline" label="Opening the game…" />);

  if (state.status === 'lobby') {
    const inList = host.players.filter((p) => p.status === 'in');
    const out = host.players.filter((p) => p.status !== 'in');
    const max = host.ready ?? 0;
    const want = count ?? String(Math.min(host.perGame, Math.max(max, 1)));
    const n = Math.max(1, Math.min(Math.round(Number(want)) || 1, Math.max(max, 1)));
    const setN = async (v: number) => { const c = Math.max(1, Math.min(v, Math.max(max, 1))); setCount(String(c)); await act({ action: 'count', count: c }); };
    return frame(<>
      <div className={styles.ticket}>
        <Tape />
        {url && <div className={styles.ticketQr}><TriviaQr url={url} size={230} /></div>}
        <div className={styles.ticketCode}>
          <p className={styles.kicker}>Join the game</p>
          <p className={styles.how}>Scan the code, or open Trivia in the portal and type</p>
          <div className={styles.codeBig} aria-label={`Join code ${code.split('').join(' ')}`}>{code}</div>
        </div>
      </div>
      <div className={styles.controls}>
        <span className={styles.stepper}>
          <span className={styles.mid}>Questions</span>
          <Button size="sm" variant="secondary" aria-label="Fewer questions" disabled={n <= 1} onClick={() => void setN(n - 1)}>−</Button>
          <Input type="number" min={1} max={Math.max(max, 1)} value={want} aria-label="Number of questions" onChange={(e) => setCount(e.target.value)} onBlur={() => void setN(n)} />
          <Button size="sm" variant="secondary" aria-label="More questions" disabled={n >= max} onClick={() => void setN(n + 1)}>+</Button>
          <span className={styles.dim}>of {max} in the pool</span>
        </span>
      </div>
      <div className={styles.controls}>
        <Button className={styles.startBtn} loading={busy} disabled={!inList.length || !max} onClick={async () => { if (await act({ action: 'start', count: n })) await reload(); }}>Start Game</Button>
        <Button variant="secondary" onClick={async () => { if (await confirmHold({ title: 'Close this game?', message: 'Nobody has played yet, so nothing is lost.', confirmLabel: 'Hold to close' })) { const r = await call('DELETE', `/api/trivia/games/${code}`); if (r.ok) onLeave(); else setProblem(r.error); } }}>Close Game</Button>
      </div>
      {!max && <p className={styles.needs} style={{ textAlign: 'center' }}>This quiz has no finished questions yet: each needs text, four answers and a right answer.</p>}
      {!inList.length ? <p className={`${styles.mid} ${styles.pulse}`} style={{ textAlign: 'center' }}>Waiting for players to join…</p> : (
        <div className={styles.chips}>{inList.map((p) => <span key={p.id} className={styles.chip}>{p.name}<button type="button" className={styles.chipX} aria-label={`Remove ${p.name}`} onClick={() => void act({ action: 'remove', user_id: p.id })}><UserMinus size={14} /></button></span>)}</div>
      )}
      {out.length > 0 && (
        <div className={styles.holdBox}>
          <p className={styles.kicker} style={{ alignSelf: 'flex-start' }}>Not in</p>
          <span className={styles.muted}>Top 3 of an earlier game of this quiz, or taken out. Letting someone in needs a hold.</span>
          <div className={styles.chips}>{out.map((p) => <span key={p.id} className={styles.chip}>{p.name} <span style={{ color: '#5a6580' }}>({p.status === 'blocked' ? 'past top 3' : 'removed'})</span><button type="button" className={styles.chipX} aria-label={`Let ${p.name} in`} onClick={async () => { if (await confirmHold({ title: `Let ${p.name} in?`, message: p.status === 'blocked' ? 'They were in the top 3 of an earlier game of this quiz.' : 'They were taken out of this game.', confirmLabel: 'Hold to let in' })) { if (await act({ action: 'allow', user_id: p.id })) showToast(`${p.name} is in`); } }}><UserPlus size={14} /></button></span>)}</div>
        </div>
      )}
    </>);
  }

  if (state.status === 'done') {
    const top = state.reveal?.top ?? [];
    const order = [top[1], top[0], top[2]];
    return frame(<>
      {top.length > 0 && <Confetti />}
      <p className={styles.big} style={{ textAlign: 'center' }}>{top.length ? 'And the winners are…' : 'Game over'}</p>
      {top.length > 0 && <div className={styles.podium}>{order.map((p, i) => p && <div key={i} className={`${styles.step} ${[styles.step2, styles.step1, styles.step3][i]}`}>{p.rank === 1 && <span className={styles.winnerTag}>Winner</span>}<span className={styles.stepRank}>{p.rank}</span><span className={styles.stepName}>{p.name}</span><span className={styles.stepScore}>{fmtScore(p.score)} pts</span></div>)}</div>}
      {!state.practice && top.length > 0 && <p className={styles.muted} style={{ textAlign: 'center' }}>{top.length === 1 ? 'The winner' : `The top ${top.length}`} can’t join this quiz’s next game unless you let them in.</p>}
      <div className={styles.controls}><Button onClick={onResults}>See Results</Button><Button variant="secondary" onClick={onLeave}>Done</Button></div>
    </>);
  }

  if (!q) return frame(<Loading variant="inline" label="Loading…" />);
  const last = state.current + 1 >= state.total;
  const secs = Math.ceil(left / 1000);
  const rv = state.status === 'reveal' ? state.reveal : undefined;
  const maxCount = Math.max(1, ...(rv?.counts ?? [1]));
  return frame(<>
    <div className={styles.qTop}>
      <span className={`${styles.badge} ${styles.neutral}`}>Question {state.current + 1} of {state.total}</span>
      <span className={styles.spacer} />
      {state.status === 'question' && <span className={`${styles.badge} ${styles.good}`}>{state.answered ?? 0} / {state.players} answered</span>}
    </div>
    {state.status === 'question' && <div className={`${styles.clockRow} ${secs <= 5 ? styles.clockLow : ''}`}><span className={styles.timer}>{secs}</span><div className={styles.clock}><div className={styles.clockFill} style={{ width: `${Math.min(100, (left / (q.secs * 1000)) * 100)}%` }} /></div></div>}
    <div className={styles.qCard} key={state.current}><Tape /><p className={styles.qText}>{q.text}</p></div>
    <div className={styles.answers}>
      {q.choices.map((c, i) => {
        const isRight = rv?.correct === i;
        return (
          <div key={i} className={`${styles.ans} ${ansClass(i)} ${rv && !isRight ? styles.dimmed : ''} ${rv && isRight ? styles.right : ''}`}>
            <Shape i={i} /><Letter i={i} /><span className={styles.ansText}>{c}</span>
            {rv && <span className={styles.ansCount}>{rv.counts?.[i] ?? 0}</span>}
            {rv && isRight && <span className={styles.tick}><Check size={22} aria-label="Right answer" /></span>}
            {rv && <span className={styles.ansBar} style={{ width: `${((rv.counts?.[i] ?? 0) / maxCount) * 100}%` }} />}
          </div>
        );
      })}
    </div>
    {rv && rv.top.length > 0 && <div className={styles.board}>{rv.top.map((p, i) => <div key={i} className={styles.boardRow}><span className={`${styles.rankNum} ${p.rank === 1 ? styles.rankNum1 : ''}`}>{p.rank}</span><span className={styles.boardName}>{p.name}</span><b>{fmtScore(p.score)}</b></div>)}</div>}
    <div className={styles.controls}>
      {state.status === 'question'
        ? <Button variant="secondary" loading={busy} onClick={async () => { closing.current = `${state.gameId}:${current}`; await act({ action: 'reveal' }); await reload(); }}>Reveal Answer</Button>
        : !rv ? <span className={`${styles.mid} ${styles.pulse}`}>Counting the answers…</span>
        : <Button className={styles.startBtn} loading={busy} onClick={async () => { await act({ action: 'next' }); await reload(); }}>{last ? 'Show Podium' : 'Next Question'}</Button>}
    </div>
  </>);
}
