'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, UserMinus, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { call } from './api';
import { useCountdown, useGame } from './useGame';
import { Stage, CountUp, FloatShapes, Ring, Confetti, Letter, Shape, Tape, CategoryCard, ansClass, fmtScore } from './shapes';
import TriviaQr from './TriviaQr';
import styles from './trivia.module.css';

// Running a game: the big screen, in the navy show look. The lobby is one ticket with the QR code and the join code; each question shows the clock and how many have answered; then the answer, how many
// chose what and the top five; at the end the podium. Everything is a button press here, the server keeps the game; reloading this page picks it up where it was.
export default function HostGame({ code, onLeave, onResults }: { code: string; onLeave: () => void; onResults: (quizSlug: string) => void }) {
  const { state, host, error, gone, serverNow, reload } = useGame(code, 'host');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [find, setFind] = useState('');
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

  const frame = (body: React.ReactNode, foot?: React.ReactNode, urgent?: boolean) => (
    <Stage><div className={`${styles.stage} ${urgent ? styles.urgent : ''}`} role="dialog" aria-label="Hosting Trivia"><FloatShapes />
      <div className={styles.stageBar}>
        <button type="button" className={styles.stageBack} onClick={onLeave} aria-label="Leave this screen (the game keeps going)"><ArrowLeft size={18} /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logo} src="/logos/tg_logo.png" alt="" />
        <b>{state?.quiz || 'Trivia'}</b>
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
    const n = Math.max(1, Math.min(host.perGame, Math.max(max, 1)));   // fixed by the quiz's own setting; the host does not change it here
    return frame(<>
      <div className={styles.ticket}>
        <Tape />
        {url && <div className={styles.ticketQr}><TriviaQr url={url} size={230} /></div>}
        <div className={styles.ticketCode}>
          <p className={styles.kicker}>Join the game</p>
          <p className={styles.how}>Scan the code, or open Trivia in the portal and type</p>
          <div className={styles.codeBig} aria-label={`Join code ${code.split('').join(' ')}`}>{code.split('').map((ch, i) => <span key={i} style={{ ['--i' as string]: i }} aria-hidden="true">{ch}</span>)}</div>
        </div>
      </div>
      <div className={styles.lobbyBar}>
        <p className={styles.lobbyInfo}><b>{n} {n === 1 ? 'question' : 'questions'}</b> this game <span aria-hidden="true">·</span> drawn at random from {max}</p>
        <div className={styles.controls}>
          <Button className={styles.startBtn} loading={busy} disabled={!inList.length || !max} onClick={async () => { if (await act({ action: 'start' })) await reload(); }}>Start Game</Button>
          <Button variant="ghost" className={styles.closeBtn} onClick={async () => { if (await confirmHold({ title: 'Close this game?', message: 'Nobody has played yet, so nothing is lost.', confirmLabel: 'Hold to close' })) { const r = await call('DELETE', `/api/trivia/games/${code}`); if (r.ok) onLeave(); else setProblem(r.error); } }}>Close Game</Button>
        </div>
        {!max ? <p className={styles.needs}>This quiz has no finished questions yet: each needs text, four answers and a right answer.</p>
          : !inList.length ? <p className={`${styles.lobbyInfo} ${styles.waiting}`}>Waiting for the first player to join</p> : null}
      </div>
      {inList.length > 0 && (
        <div className={styles.players}>
          <div className={styles.playersHead}>
            <span className={styles.kicker}>Players</span><b className={styles.playersCount}>{inList.length}</b>
            {inList.length > 12 && <input className={styles.playerSearch} value={find} placeholder="Find a player" aria-label="Find a player" onChange={(e) => setFind(e.target.value)} />}
          </div>
          <div className={`${styles.chips} ${inList.length > 24 ? styles.chipsDense : ''}`}>
            {inList.filter((p) => p.name.toLowerCase().includes(find.trim().toLowerCase())).map((p) => <span key={p.id} className={styles.chip}>{p.name}<button type="button" className={styles.chipX} aria-label={`Remove ${p.name}`} onClick={() => void act({ action: 'remove', user_id: p.id })}><UserMinus size={14} /></button></span>)}
          </div>
        </div>
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
      {top.length > 0 && <Confetti delay={3.2} />}
      <p className={styles.big} style={{ textAlign: 'center' }}>{top.length ? 'And the winners are…' : 'Game over'}</p>
      {top.length > 0 && <div className={styles.podium}>{order.map((p, i) => p && <div key={i} className={`${styles.step} ${[styles.step2, styles.step1, styles.step3][i]}`}>{p.rank === 1 && <span className={styles.winnerTag}>Winner</span>}<span className={styles.stepRank}>{p.rank}</span><span className={styles.stepName}>{p.name}</span><span className={styles.stepScore}><CountUp value={p.score} ms={1400} format={fmtScore} /> pts</span></div>)}</div>}
      {host.blocks && top.length > 0 && <p className={styles.muted} style={{ textAlign: 'center' }}>{top.length === 1 ? 'The winner' : `The top ${top.length}`} can’t join this quiz’s next game unless you let them in.</p>}
      <div className={styles.controls}><Button onClick={() => onResults(host.quizSlug)}>See Results</Button><Button variant="secondary" onClick={onLeave}>Done</Button></div>
    </>);
  }

  if (!q) return frame(<Loading variant="inline" label="Loading…" />);
  const last = state.current + 1 >= state.total;
  const secs = Math.ceil(Math.min(left, q.secs * 1000) / 1000);
  const carding = state.status === 'question' && !!q.category && q.startedAt > serverNow();   // the category card shows first; the question and its clock start after it
  const rv = state.status === 'reveal' ? state.reveal : undefined;
  const maxCount = Math.max(1, ...(rv?.counts ?? [1]));
  return frame(<>
    <div className={styles.qTop}>
      <span className={`${styles.badge} ${styles.neutral}`}>Question {state.current + 1} of {state.total}</span>
      <span className={styles.spacer} />
      {state.status === 'question' && <span className={`${styles.badge} ${styles.good}`}>{state.answered ?? 0} / {state.players} answered</span>}
    </div>
    {carding && <CategoryCard category={q.category!} n={state.current + 1} total={state.total} />}
    {!carding && state.status === 'question' && <div className={styles.answeredMeter} role="progressbar" aria-label="Players who have answered" aria-valuemin={0} aria-valuemax={state.players} aria-valuenow={state.answered ?? 0}><div className={styles.answeredFill} style={{ width: `${state.players ? Math.min(100, ((state.answered ?? 0) / state.players) * 100) : 0}%` }} /></div>}
    {!carding && state.status === 'question' && <div className={`${styles.clockRow} ${secs <= 5 ? styles.clockLow : ''}`}><Ring left={Math.min(left, q.secs * 1000)} total={q.secs * 1000} low={secs <= 5} /><div className={styles.clock}><div className={styles.clockFill} style={{ width: `${Math.min(100, (left / (q.secs * 1000)) * 100)}%` }} /></div></div>}
    {!carding && <div className={styles.qCard} key={state.current}><Tape />{q.category && <p className={styles.kicker}>{q.category}</p>}<p className={styles.qText}>{q.text}</p></div>}
    {!carding && <div className={styles.answers}>
      {q.choices.map((c, i) => {
        const isRight = rv?.correct === i;
        return (
          <div key={i} className={`${styles.ans} ${ansClass(i)} ${rv && !isRight ? styles.dimmed : ''} ${rv && isRight ? styles.right : ''}`}>
            <Shape i={i} /><Letter i={i} /><span className={styles.ansText}>{c}</span>
            {rv && <span className={styles.ansCount}><CountUp value={rv.counts?.[i] ?? 0} ms={900} /></span>}
            {rv && isRight && <span className={styles.tick}><Check size={22} aria-label="Right answer" /></span>}
            {rv && <span className={styles.ansBar} style={{ width: `${((rv.counts?.[i] ?? 0) / maxCount) * 100}%` }} />}
          </div>
        );
      })}
    </div>}
    {rv && rv.top.length > 0 && <div className={styles.board}>{rv.top.map((p, i) => <div key={i} className={styles.boardRow}><span className={`${styles.rankNum} ${p.rank === 1 ? styles.rankNum1 : ''}`}>{p.rank}</span><span className={styles.boardName}>{p.name}</span><b><CountUp value={p.score} ms={1000} format={fmtScore} /></b></div>)}</div>}
    <div className={styles.controls}>
      {state.status === 'question'
        ? <Button variant="secondary" loading={busy} onClick={async () => { closing.current = `${state.gameId}:${current}`; await act({ action: 'reveal' }); await reload(); }}>Reveal Answer</Button>
        : !rv ? <span className={`${styles.mid} ${styles.pulse}`}>Counting the answers…</span>
        : <Button className={styles.startBtn} loading={busy} onClick={async () => { await act({ action: 'next' }); await reload(); }}>{last ? 'Show Podium' : 'Next Question'}</Button>}
    </div>
  </>, undefined, state.status === 'question' && secs <= 5 && left > 0);
}
