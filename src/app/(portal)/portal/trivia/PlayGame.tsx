'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { call } from './api';
import { useCountdown, useGame, useWakeLock } from './useGame';
import { CARD_MS } from '@/lib/trivia/game';
import { Stage, CountUp, FloatShapes, Ring, Confetti, Shape, Tape, CategoryCard, Countdown, ShapeLoader, FitBox, ansClass, fmtScore, ordinal } from './shapes';
import styles from './trivia.module.css';

// A game on a phone: join the lobby, tap an answer while the clock runs, see how you did after each question, and your place at the end. The whole screen, in the navy show look.
export default function PlayGame({ code, onLeave }: { code: string; onLeave: () => void }) {
  const { state, me, error, gone, serverNow } = useGame(code, 'player');
  useWakeLock(); // a phone that dims in the middle of a question loses the tap
  const [picked, setPicked] = useState<{ q: number; pos: number } | null>(null);
  const [problem, setProblem] = useState('');
  const q = state?.question;
  const left = useCountdown(state?.status === 'question' ? q?.endsAt : null, serverNow);

  // An answer sent from this phone, or one the server already has (after a refresh), shows as picked.
  const mine = picked && state && picked.q === state.current ? picked.pos : state?.status === 'question' && me?.answeredQ === state.current ? me.answered : null;
  useEffect(() => {
    setProblem('');
  }, [state?.current, state?.status]);

  const answer = useCallback(
    async (pos: number) => {
      if (!state || mine !== null) return;
      setPicked({ q: state.current, pos });
      // A tap that hit a hiccup (no connection, or the server was busy) is sent again; the server keeps the first answer, so sending twice is safe.
      let r = await call<{ pos: number }>('POST', `/api/trivia/play/${code}/answer`, { q: state.current, pos });
      for (let again = 0; again < 3 && !r.ok && (r.status === 0 || r.status >= 500); again++) {
        await new Promise((res) => setTimeout(res, 400 * (again + 1)));
        r = await call<{ pos: number }>('POST', `/api/trivia/play/${code}/answer`, { q: state.current, pos });
      }
      if (r.ok) {
        setPicked({ q: state.current, pos: r.data.pos });
        return;
      }
      setPicked(null);
      setProblem(r.error);
    },
    [state, mine, code],
  );

  const frame = (title: string, body: React.ReactNode, urgent?: boolean) => (
    <Stage>
      <div className={`${styles.stage} ${urgent ? styles.urgent : ''}`} role="dialog" aria-label="Trivia">
        <FloatShapes />
        <div className={styles.stageBar}>
          <button type="button" className={styles.stageBack} onClick={onLeave} aria-label="Leave the game">
            <ArrowLeft size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src="/logos/tg_logo.png" alt="" />
          <b>{title}</b>
          {state && (
            <span className={`${styles.badge} ${styles.neutral} ${styles.spacer}`}>
              {state.players} {state.players === 1 ? 'player' : 'players'}
            </span>
          )}
        </div>
        <FitBox className={`${styles.stageBody} ${styles.center}`}>{body}</FitBox>
      </div>
    </Stage>
  );
  const card = (kicker: string, children: React.ReactNode, tone?: 'ok' | 'no') => (
    <div className={`${styles.phoneResult} ${tone === 'ok' ? styles.phoneOk : tone === 'no' ? styles.phoneNo : ''}`}>
      <Tape />
      <p className={styles.kicker}>{kicker}</p>
      {children}
    </div>
  );

  if (gone)
    return frame(
      'Trivia',
      card(
        'Oh no',
        <>
          <p className={styles.big}>That game is gone.</p>
          <p className={styles.mid}>{error || 'It may have been deleted by the host.'}</p>
          <Button onClick={onLeave}>Back</Button>
        </>,
      ),
    );
  if (!state || !me)
    return frame(
      'Trivia',
      error ? (
        <p className={styles.mid} role="alert">
          {error}
        </p>
      ) : (
        <ShapeLoader label="Joining…" />
      ),
    );
  const title = state.quiz || 'Trivia';
  if (me.status === 'blocked')
    return frame(
      title,
      card(
        'Not this time',
        <>
          <p className={styles.big}>You can’t play this one again.</p>
          <p className={styles.mid}>You were in the top 3 of an earlier game of this quiz. If the host says it is fine, they can let you in, and this screen will update.</p>
          <Button variant="secondary" onClick={onLeave}>
            Back
          </Button>
        </>,
        'no',
      ),
    );
  if (me.status === 'removed')
    return frame(
      title,
      card(
        'Out',
        <>
          <p className={styles.big}>You were taken out of this game.</p>
          <p className={styles.mid}>The host can let you back in.</p>
          <Button variant="secondary" onClick={onLeave}>
            Back
          </Button>
        </>,
        'no',
      ),
    );

  const mineResult = state.reveal?.results[me.userId];
  if (state.status === 'lobby')
    return frame(
      title,
      card(
        'You’re in',
        <>
          <p className={styles.big}>Get ready!</p>
          <p className={styles.mid}>Waiting for the host to start…</p>
          <ShapeLoader label={`${state.players} ${state.players === 1 ? 'player' : 'players'} here`} />
        </>,
        'ok',
      ),
    );

  if (state.status === 'done') {
    const r = mineResult;
    const podium = !!r && r.rank <= 3 && r.score > 0;
    return frame(
      title,
      <>
        {podium && <Confetti delay={0.3} />}
        {card(
          podium ? 'You made the podium' : 'Game over',
          <>
            <p className={styles.big}>{r ? `You finished ${ordinal(r.rank)}` : 'The game is over.'}</p>
            {r && (
              <div className={styles.phoneFoot}>
                <span>{fmtScore(r.score)} points</span>
                {state.reveal && <span>of {state.reveal.of} players</span>}
              </div>
            )}
          </>,
          podium ? 'ok' : undefined,
        )}
        {state.reveal && state.reveal.top.length > 0 && (
          <div className={styles.board}>
            {state.reveal.top.map((p, i) => (
              <div key={i} className={styles.boardRow}>
                <span className={`${styles.rankNum} ${p.rank === 1 ? styles.rankNum1 : ''}`}>{p.rank}</span>
                <span className={styles.boardName}>{p.name}</span>
                <b>{fmtScore(p.score)}</b>
              </div>
            ))}
          </div>
        )}
        <Button variant="secondary" onClick={onLeave}>
          Done
        </Button>
      </>,
    );
  }

  if (!q) return frame(title, <ShapeLoader label="Loading…" />);
  const progress = (
    <span className={`${styles.badge} ${styles.neutral}`}>
      Question {state.current + 1} of {state.total}
    </span>
  );

  if (state.status === 'reveal' && !state.reveal)
    return frame(
      title,
      <>
        <p className={styles.big}>Time’s up!</p>
        <ShapeLoader label="Counting the answers…" />
      </>,
    ); // the host closed the question; the answer is being counted
  if (state.status === 'reveal') {
    const r = mineResult;
    const rights = state.reveal?.correct === undefined ? [] : [state.reveal.correct, ...(state.reveal.also ?? [])]; // a question can have several right answers
    const isRight = (i: number) => rights.includes(i);
    return frame(
      title,
      <>
        {r?.ok && <Confetti burst />}
        {progress}
        {card(
          r?.ok ? 'Correct!' : r?.pos === null || r === undefined ? 'No answer' : 'Not quite',
          <>
            <p className={styles.big} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {r?.ok ? (
                <>
                  <Check size={34} aria-hidden="true" /> Nice one
                </>
              ) : (
                <>
                  <X size={34} aria-hidden="true" /> {r?.pos === null || r === undefined ? 'Too slow' : 'Close one'}
                </>
              )}
            </p>
            {r?.ok && (
              <p className={styles.pts}>
                <span className={styles.ptsBurst}>
                  +<CountUp value={r.pts} ms={900} />
                </span>
              </p>
            )}
            {!r?.ok && rights.length > 0 && (
              <p className={styles.mid}>
                {rights.length > 1 ? 'The answers were ' : 'The answer was '}
                {rights.map((i, k) => (
                  <span key={i}>
                    {k > 0 ? ', ' : ''}
                    <b>{q.choices[i]}</b>
                  </span>
                ))}
              </p>
            )}
            {r?.ok && (r.streak ?? 0) >= 2 && <p className={styles.streak}>{r.streak} in a row</p>}
            {r && (
              <div className={styles.phoneFoot}>
                <span>{ordinal(r.rank)} place</span>
                <span>
                  <CountUp value={r.score} from={Math.max(0, r.score - r.pts)} ms={1100} format={fmtScore} /> points
                </span>
              </div>
            )}
          </>,
          r?.ok ? 'ok' : 'no',
        )}
        <div className={styles.recap} aria-label="Your answer and the right answer">
          {q.choices.map((c, i) => (
            <div key={i} className={`${styles.recapRow} ${isRight(i) ? styles.recapRight : ''} ${r?.pos === i && !isRight(i) ? styles.recapWrong : ''}`}>
              <Shape i={i} solid />
              <span>{c}</span>
              {isRight(i) && (
                <span className={styles.recapTag}>
                  <Check size={14} aria-hidden="true" /> Right answer
                </span>
              )}
              {r?.pos === i && !isRight(i) && (
                <span className={styles.recapTag}>
                  <X size={14} aria-hidden="true" /> Your answer
                </span>
              )}
              {r?.pos === i && isRight(i) && <span className={styles.recapTag}>You got it</span>}
            </div>
          ))}
        </div>
        <p className={`${styles.mid} ${styles.waiting}`}>Waiting for the next question</p>
      </>,
    );
  }

  // An open question.
  const secs = Math.ceil(Math.min(left, q.secs * 1000) / 1000);
  const closed = left <= 0;
  // A question with a category opens on its category card; the question, its answers and the clock start after it.
  const cardStart = q.startedAt - (q.category ? CARD_MS : 0);
  if (state.current === 0 && cardStart > serverNow()) return frame(title, <Countdown n={Math.ceil((cardStart - serverNow()) / 1000)} />); // 3-2-1-GO first
  if (q.category && q.startedAt > serverNow()) return frame(title, <CategoryCard category={q.category} n={state.current + 1} total={state.total} />);
  return frame(
    title,
    <div style={{ width: '100%', maxWidth: '40rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
      <div className={styles.row}>
        {progress}
        <span className={styles.muted} style={{ color: 'rgba(242, 241, 240, 0.75)' }}>
          Read the question on the big screen
        </span>
      </div>{' '}
      {/* theme-ok */}
      <div className={`${styles.clockRow} ${secs <= 5 ? styles.clockLow : ''}`}>
        <Ring left={Math.min(left, q.secs * 1000)} total={q.secs * 1000} low={secs <= 5} />
        <div className={styles.clock}>
          <div className={styles.clockFill} style={{ width: `${Math.min(100, (left / (q.secs * 1000)) * 100)}%` }} />
        </div>
      </div>
      {closed && mine === null ? (
        <div style={{ alignSelf: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>{card('Time’s up', <p className={styles.big}>Too slow!</p>, 'no')}</div>
      ) : (
        <div className={styles.phoneAnswers}>
          {q.choices.map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={mine !== null}
              aria-label={`Answer ${'ABCD'[i]}`}
              className={`${styles.ans} ${ansClass(i)} ${mine === i ? styles.picked : mine !== null ? styles.notPicked : ''}`}
              onClick={() => void answer(i)}
            >
              <Shape i={i} solid />
            </button>
          ))}
        </div>
      )}
      {mine !== null && (
        <div className={styles.lockedCard} style={{ alignSelf: 'center', textAlign: 'center' }}>
          <span className={styles.kicker}>Locked in</span>
          <p className={`${styles.mid} ${styles.waiting}`} style={{ marginTop: '0.6rem' }}>
            Waiting for the others
          </p>
        </div>
      )}
      {problem && (
        <p role="alert" className={styles.needs}>
          {problem}
        </p>
      )}
    </div>,
    secs <= 5 && !closed,
  );
}
