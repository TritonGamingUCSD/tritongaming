'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Crown, Medal, UserMinus, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { confirmHold } from '@/lib/ui/confirmHold';
import { showToast } from '@/lib/ui/toast';
import { call } from './api';
import { useCountdown, useGame } from './useGame';
import { AUTO_NEXT_SECS, CARD_MS } from '@/lib/trivia/game';
import { Stage, CountUp, FloatShapes, Ring, Confetti, Shape, Tape, CategoryCard, Countdown, ShapeLoader, Sweep, FitBox, ansClass, fmtScore } from './shapes';
import Scoreboard from './Scoreboard';
import TriviaQr from './TriviaQr';
import styles from './trivia.module.css';

// Running a game: the big screen, in the navy show look. The lobby is one ticket with the QR code and the join code; each question shows the clock and how many have answered; then the answer, how many
// chose what and the top five; at the end the podium. Everything is a button press here, the server keeps the game; reloading this page picks it up where it was.
export default function HostGame({
  code,
  onLeave,
  onResults,
  onNewGame,
}: {
  code: string;
  onLeave: () => void;
  onResults: (quizSlug: string) => void;
  onNewGame: (code: string) => void;
}) {
  const { state, host, error, gone, serverNow, reload } = useGame(code, 'host');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [find, setFind] = useState('');
  // A game open to guests points its QR code at the public play page (no account needed); any other at the portal.
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}${host.guests ? '/play' : '/portal/trivia/play'}/${code}`;
  const q = state?.question;
  const left = useCountdown(state?.status === 'question' ? q?.endsAt : null, serverNow);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setProblem('');
    const r = await call('POST', `/api/trivia/games/${code}`, body);
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      void reload();
      return false;
    }
    return true;
  };

  // The question closes by itself when the clock runs out (a moment later, so answers still on their way count) or as soon as everybody in has answered.
  const closing = useRef('');
  const status = state?.status,
    current = state?.current ?? -1;
  const everyone = !!state && state.players > 0 && (state.answered ?? 0) >= state.players;
  useEffect(() => {
    if (status !== 'question' || !q) return;
    const key = `${state?.gameId}:${current}`;
    const wait = everyone ? 700 : Math.max(0, q.endsAt - serverNow()) + 1300;
    const t = setTimeout(() => {
      if (closing.current !== key) {
        closing.current = key;
        void call('POST', `/api/trivia/games/${code}`, { action: 'reveal' }).then(() => reload());
      }
    }, wait);
    return () => clearTimeout(t);
  }, [status, current, everyone, q, code, serverNow, reload, state?.gameId]);

  // After the answer has been shown for AUTO_NEXT_SECS (6) seconds with no button pressed the game moves on by itself: to the next question, or after the last one to the results (the button counts it down).
  const [nextIn, setNextIn] = useState<number | null>(null);
  const shown = status === 'reveal' && !!state?.reveal;
  useEffect(() => {
    if (!shown) {
      setNextIn(null);
      return;
    }
    let left = AUTO_NEXT_SECS;
    setNextIn(left);
    const id = setInterval(() => {
      left -= 1;
      setNextIn(left);
      if (left <= 0) {
        clearInterval(id);
        void call('POST', `/api/trivia/games/${code}`, { action: 'next' }).then(() => reload());
      }
    }, 1000);
    return () => clearInterval(id);
  }, [shown, current, code, reload]);

  const frame = (body: React.ReactNode, foot?: React.ReactNode, urgent?: boolean) => (
    <Stage>
      <div className={`${styles.stage} ${urgent ? styles.urgent : ''}`} role="dialog" aria-label="Hosting Trivia">
        <FloatShapes />
        <div className={styles.stageBar}>
          {state?.status === 'question' && <Sweep key={`sweep-${state?.current}`} />}
          <button type="button" className={styles.stageBack} onClick={onLeave} aria-label="Leave this screen (the game keeps going)">
            <ArrowLeft size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src="/logos/tg_logo.png" alt="" />
          <b>{state?.quiz || 'Trivia'}</b>
          <span className={`${styles.badge} ${styles.neutral} ${styles.spacer}`}>
            {state?.players ?? 0} {state?.players === 1 ? 'player' : 'players'}
          </span>
          {state && state.status !== 'done' && state.status !== 'lobby' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (await confirmHold({ title: 'End this game now?', message: 'The podium is shown with the scores so far.', confirmLabel: 'Hold to end' }))
                  await act({ action: 'end' });
              }}
            >
              End Game
            </Button>
          )}
        </div>
        <FitBox className={styles.stageBody}>
          {body}
          {problem && (
            <p role="alert" className={styles.needs} style={{ textAlign: 'center' }}>
              {problem}
            </p>
          )}
          {foot}
        </FitBox>
      </div>
    </Stage>
  );

  if (gone)
    return frame(
      <div className={styles.center} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <p className={styles.big}>That game is gone.</p>
        <p className={styles.mid}>{error}</p>
        <Button onClick={onLeave}>Back</Button>
      </div>,
    );
  if (!state)
    return frame(
      error ? (
        <p className={styles.mid} role="alert">
          {error}
        </p>
      ) : (
        <ShapeLoader label="Opening the game…" />
      ),
    );

  if (state.status === 'lobby') {
    const inList = host.players.filter((p) => p.status === 'in');
    const out = host.players.filter((p) => p.status !== 'in');
    const max = host.ready ?? 0;
    const n = Math.max(1, Math.min(host.perGame, Math.max(max, 1))); // fixed by the quiz's own setting; the host does not change it here
    return frame(
      <>
        <div className={styles.ticket}>
          <Tape />
          {url && (
            <div className={styles.ticketQr}>
              <TriviaQr url={url} size={230} />
            </div>
          )}
          <div className={styles.ticketCode}>
            <p className={styles.kicker}>Join the game</p>
            <p className={styles.how}>{host.guests ? 'Scan the code, or go to tritongaming.org/play and type' : 'Scan the code, or open Trivia in the portal and type'}</p>
            <div className={styles.codeBig} aria-label={`Join code ${code.split('').join(' ')}`}>
              {code.split('').map((ch, i) => (
                <span key={i} style={{ ['--i' as string]: i }} aria-hidden="true">
                  {ch}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.lobbyBar}>
          <p className={styles.lobbyInfo}>
            <b>
              {n} {n === 1 ? 'question' : 'questions'}
            </b>{' '}
            this game <span aria-hidden="true">·</span> drawn at random from {max}
          </p>
          <div className={styles.controls}>
            <Button
              className={styles.startBtn}
              loading={busy}
              disabled={!inList.length || !max}
              onClick={async () => {
                if (await act({ action: 'start' })) await reload();
              }}
            >
              Start Game
            </Button>
            <Button
              variant="ghost"
              className={styles.closeBtn}
              onClick={async () => {
                if (await confirmHold({ title: 'Close this game?', message: 'Nobody has played yet, so nothing is lost.', confirmLabel: 'Hold to close' })) {
                  const r = await call('DELETE', `/api/trivia/games/${code}`);
                  if (r.ok) onLeave();
                  else setProblem(r.error);
                }
              }}
            >
              Close Game
            </Button>
          </div>
          {!max ? (
            <p className={styles.needs}>This quiz has no finished questions yet: each needs text, four answers and a right answer.</p>
          ) : !inList.length ? (
            <ShapeLoader label="Waiting for the first player to join" />
          ) : null}
        </div>
        {inList.length > 0 && (
          <div className={styles.players}>
            <div className={styles.playersHead}>
              <span className={styles.kicker}>Players</span>
              <b key={inList.length} className={styles.playersCount}>
                {inList.length}
              </b>
              {inList.length > 12 && (
                <input className={styles.playerSearch} value={find} placeholder="Find a player" aria-label="Find a player" onChange={(e) => setFind(e.target.value)} />
              )}
            </div>
            <div className={`${styles.chips} ${inList.length > 24 ? styles.chipsDense : ''}`}>
              {inList
                .filter((p) => p.name.toLowerCase().includes(find.trim().toLowerCase()))
                .map((p) => (
                  <span key={p.id} className={styles.chip}>
                    {p.name}
                    <button type="button" className={styles.chipX} aria-label={`Remove ${p.name}`} onClick={() => void act({ action: 'remove', user_id: p.id })}>
                      <UserMinus size={14} />
                    </button>
                  </span>
                ))}
            </div>
          </div>
        )}
        {out.length > 0 && (
          <div className={styles.holdBox}>
            <p className={styles.kicker} style={{ alignSelf: 'flex-start' }}>
              Not in
            </p>
            <span className={styles.muted}>Top 3 of an earlier game of this quiz, or taken out. Letting someone in needs a hold.</span>
            <div className={styles.chips}>
              {out.map((p) => (
                <span key={p.id} className={styles.chip}>
                  {p.name} <span style={{ color: '#5a6580' }}>({p.status === 'blocked' ? 'past top 3' : 'removed'})</span>
                  <button
                    type="button"
                    className={styles.chipX}
                    aria-label={`Let ${p.name} in`}
                    onClick={async () => {
                      if (
                        await confirmHold({
                          title: `Let ${p.name} in?`,
                          message: p.status === 'blocked' ? 'They were in the top 3 of an earlier game of this quiz.' : 'They were taken out of this game.',
                          confirmLabel: 'Hold to let in',
                        })
                      ) {
                        if (await act({ action: 'allow', user_id: p.id })) showToast(`${p.name} is in`);
                      }
                    }}
                  >
                    <UserPlus size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </>,
    );
  }

  if (state.status === 'done') {
    const top = state.reveal?.top ?? [];
    const more = state.reveal?.more ?? [];
    const stats = state.reveal?.stats;
    const order = [top[1], top[0], top[2]];
    const best = Math.max(1, top[0]?.score ?? 1);
    // A long name is set smaller so it still fits its plate on one or two lines.
    const nameSize = (name: string) =>
      `clamp(${name.length > 18 ? '0.85rem' : name.length > 11 ? '1rem' : '1.2rem'}, ${name.length > 18 ? 1.6 : name.length > 11 ? 2 : 2.6}vw, ${name.length > 18 ? '1.3rem' : name.length > 11 ? '1.7rem' : '2.3rem'})`;
    const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
    const cards: { label: string; big: string; small: string }[] = stats
      ? [
          ...(stats.fastest ? [{ label: 'Fastest right answer', big: secs(stats.fastest.ms), small: `${stats.fastest.name}, question ${stats.fastest.q}` }] : []),
          ...(stats.streak ? [{ label: 'Longest streak', big: `${stats.streak.n} in a row`, small: stats.streak.name }] : []),
          ...(stats.hardest ? [{ label: 'Toughest question', big: `${stats.hardest.pct}% right`, small: `Question ${stats.hardest.q}: ${stats.hardest.text}` }] : []),
          ...(stats.easiest ? [{ label: 'Easiest question', big: `${stats.easiest.pct}% right`, small: `Question ${stats.easiest.q}: ${stats.easiest.text}` }] : []),
          ...(stats.accuracy !== null
            ? [{ label: 'All answers', big: `${stats.accuracy}% right`, small: `${stats.asked} ${stats.asked === 1 ? 'question' : 'questions'} asked` }]
            : []),
        ]
      : [];
    return frame(
      <>
        {top.length > 0 && <Confetti delay={6.2} />}
        <p className={styles.endTitle}>{top.length ? 'And the winners are…' : 'Game over'}</p>
        <p className={styles.endSub}>
          {state.reveal?.of ?? state.players} {(state.reveal?.of ?? state.players) === 1 ? 'player' : 'players'}
          {stats ? ` · ${stats.asked} ${stats.asked === 1 ? 'question' : 'questions'}` : ''}
        </p>
        {top.length > 0 && (
          <div className={styles.podium}>
            {order.map(
              (p, i) =>
                p && (
                  <div key={i} className={`${styles.step} ${[styles.step2, styles.step1, styles.step3][i]}`}>
                    {p.rank === 1 && <span className={styles.winnerTag}>Winner</span>}
                    <span className={styles.medal}>{p.rank === 1 ? <Crown size={34} aria-hidden="true" /> : <Medal size={28} aria-hidden="true" />}</span>
                    <span className={styles.stepBadge} aria-hidden="true">
                      {(p.name.trim()[0] ?? '?').toUpperCase()}
                    </span>
                    <span className={styles.namePlate}>
                      <Tape />
                      <span className={styles.stepName} style={{ fontSize: nameSize(p.name) }}>
                        {p.name}
                      </span>
                    </span>
                    <span className={styles.stepRank}>{p.rank}</span>
                    <span className={styles.stepScore}>
                      <CountUp value={p.score} ms={1600} format={fmtScore} /> pts
                    </span>
                    {stats && stats.asked > 0 && p.right !== undefined && (
                      <span className={styles.stepRight}>
                        {p.right} of {stats.asked} right
                      </span>
                    )}
                  </div>
                ),
            )}
          </div>
        )}
        {(more.length > 0 || cards.length > 0) && (
          <div className={styles.endGrid}>
            {more.length > 0 && (
              <div className={styles.endBoard}>
                <p className={styles.kicker} style={{ alignSelf: 'flex-start' }}>
                  Also on the board
                </p>
                {more.map((p, i) => (
                  <div key={i} className={styles.endRow} style={{ animationDelay: `${8.2 + i * 0.22}s` }}>
                    <span className={styles.rankNum}>{p.rank}</span>
                    <span className={styles.boardName}>{p.name}</span>
                    <span className={styles.endBar}>
                      <span style={{ width: `${Math.max(4, (p.score / best) * 100)}%`, animationDelay: `${8.5 + i * 0.22}s` }} />
                    </span>
                    <b>{fmtScore(p.score)}</b>
                  </div>
                ))}
              </div>
            )}
            {cards.length > 0 && (
              <div className={styles.endStats}>
                {cards.map((c, i) => (
                  <div key={c.label} className={styles.statCard} style={{ animationDelay: `${9 + i * 0.35}s` }}>
                    <span className={styles.statLabel}>{c.label}</span>
                    <b className={styles.statBig}>{c.big}</b>
                    <span className={styles.statSmall}>{c.small}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {host.blocks && top.length > 0 && (
          <p className={styles.muted} style={{ textAlign: 'center' }}>
            {top.length === 1 ? 'The winner' : `The top ${top.length}`} can’t join this quiz’s next game unless you let them in.
          </p>
        )}
        <div className={styles.controls}>
          <Button
            className={styles.startBtn}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const r = await call<{ code: string }>('POST', '/api/trivia/games', { quiz: host.quizSlug });
              setBusy(false);
              if (r.ok) onNewGame(r.data.code);
              else setProblem(r.error);
            }}
          >
            New Game
          </Button>
          <Button variant="secondary" onClick={() => onResults(host.quizSlug)}>
            See Results
          </Button>
          <Button variant="ghost" className={styles.closeBtn} onClick={onLeave}>
            Done
          </Button>
        </div>
      </>,
    );
  }

  if (!q) return frame(<ShapeLoader label="Loading…" />);
  const last = state.current + 1 >= state.total;
  const secs = Math.ceil(Math.min(left, q.secs * 1000) / 1000);
  // The first question opens with 3-2-1-GO, then (when it has one) the category card; the question and its clock start after them.
  const cardStart = q.startedAt - (q.category ? CARD_MS : 0);
  const counting = state.status === 'question' && state.current === 0 && cardStart > serverNow();
  const carding = !counting && state.status === 'question' && !!q.category && q.startedAt > serverNow();
  const picture = host.images[state.current] || ''; // the question's picture goes to this screen only, never the phones
  const rv = state.status === 'reveal' ? state.reveal : undefined;
  const maxCount = Math.max(1, ...(rv?.counts ?? [1]));
  return frame(
    <>
      <div className={styles.qTop}>
        <span className={`${styles.badge} ${styles.neutral}`}>
          Question {state.current + 1} of {state.total}
        </span>
        <span className={styles.spacer} />
        {state.status === 'question' && !counting && !carding && (
          <span className={`${styles.badge} ${styles.good}`}>
            {state.answered ?? 0} / {state.players} answered
          </span>
        )}
      </div>
      {counting && <Countdown n={Math.ceil((cardStart - serverNow()) / 1000)} />}
      {carding && <CategoryCard category={q.category!} n={state.current + 1} total={state.total} />}
      {!counting && !carding && state.status === 'question' && (
        <div
          className={styles.answeredMeter}
          role="progressbar"
          aria-label="Players who have answered"
          aria-valuemin={0}
          aria-valuemax={state.players}
          aria-valuenow={state.answered ?? 0}
        >
          <div className={styles.answeredFill} style={{ width: `${state.players ? Math.min(100, ((state.answered ?? 0) / state.players) * 100) : 0}%` }} />
        </div>
      )}
      {!counting && !carding && state.status === 'question' && (
        <div className={`${styles.clockRow} ${secs <= 5 ? styles.clockLow : ''}`}>
          <Ring left={Math.min(left, q.secs * 1000)} total={q.secs * 1000} low={secs <= 5} />
          <div className={styles.clock}>
            <div className={styles.clockFill} style={{ width: `${Math.min(100, (left / (q.secs * 1000)) * 100)}%` }} />
          </div>
        </div>
      )}
      {!counting && !carding && (
        <div className={`${styles.qCard} ${picture ? styles.qCardPic : ''}`} key={`question-${state.current}`}>
          <Tape />
          {q.category && <span className={styles.catTag}>{q.category}</span>}
          <div className={`${styles.qMedia} ${picture ? styles.qMediaHas : ''}`}>
            <p className={styles.qText}>{q.text}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {picture && (
              <img
                className={styles.qPic}
                src={picture}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
        </div>
      )}
      {!counting && !carding && (
        <div className={`${styles.answers} ${rv ? styles.answersRevealed : ''}`}>
          {q.choices.map((c, i) => {
            const isRight = rv?.correct === i || !!rv?.also?.includes(i);
            return (
              <div key={i} className={`${styles.ans} ${ansClass(i)} ${rv && !isRight ? styles.dimmed : ''} ${rv && isRight ? styles.right : ''}`}>
                <Shape i={i} solid />
                <span className={styles.ansText}>{c}</span>
                {rv && (
                  <span className={styles.ansCount}>
                    <CountUp value={rv.counts?.[i] ?? 0} ms={900} />
                  </span>
                )}
                {rv && isRight && (
                  <span className={styles.tick}>
                    <Check size={22} aria-label="Right answer" />
                  </span>
                )}
                {rv && <span className={styles.ansBar} style={{ width: `${((rv.counts?.[i] ?? 0) / maxCount) * 100}%` }} />}
              </div>
            );
          })}
        </div>
      )}
      {rv && rv.top.length > 0 && <Scoreboard key={`board-${state.current}`} rows={rv.top} />}
      <div className={styles.controls}>
        {state.status === 'question' && (counting || carding) ? (
          <span className={styles.mid}> </span>
        ) : state.status === 'question' ? (
          <Button
            variant="secondary"
            loading={busy}
            onClick={async () => {
              closing.current = `${state.gameId}:${current}`;
              await act({ action: 'reveal' });
              await reload();
            }}
          >
            Reveal Answer
          </Button>
        ) : !rv ? (
          <ShapeLoader label="Counting the answers…" />
        ) : (
          <Button
            className={styles.startBtn}
            loading={busy}
            onClick={async () => {
              await act({ action: 'next' });
              await reload();
            }}
          >
            {last ? 'Show Podium' : 'Next Question'}
            {nextIn !== null && nextIn > 0 ? ` · ${nextIn}` : ''}
          </Button>
        )}
      </div>
    </>,
    undefined,
    state.status === 'question' && secs <= 5 && left > 0,
  );
}
