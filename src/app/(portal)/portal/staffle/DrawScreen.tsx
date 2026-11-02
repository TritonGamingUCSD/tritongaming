'use client';

import { ZoomImg } from '@/components/ui/PictureZoom';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Gift, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { call, type StaffleView } from './api';
import PrizeWheel, { WHEEL_MS } from './PrizeWheel';
import styles from './staffle.module.css';

type Item = StaffleView['items'][number];
const BALLS = ['#ffc72c', '#e8912d', '#d9487f', '#7db4ea', '#2fae86', '#8b6cdc', '#f2f1f0', '#e5484d']; /* theme-ok */
// A repeatable pseudo-random number from a text (so a ball keeps its path and colour between renders).
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}; // the last lines spread nearby texts (x1, x2, …) apart

// The draw, full screen for a projector. Staff press Draw: the winners are worked out and saved on the server first (so a reload shows the same), then each prize comes up in turn. The host pulls each winner
// (button, Space, Enter or →): the names of everyone who entered flicker past on the wall and in the big box, slow down and stop on the winner. Whoever already won an earlier prize fades out. Esc leaves.
export default function DrawScreen({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [s, setS] = useState<StaffleView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'spin' | 'landed' | 'shown'>('ready'); // ready: waiting for a pull; spin: names flickering; landed: stopped on a winner; shown: every winner of this prize is out
  const [shown, setShown] = useState(0); // winners of this prize pulled so far
  const [wheel, setWheel] = useState<{ names: string[]; target: string; key: number } | null>(null); // the wheel as it was set up for the last pull of this prize
  useEffect(() => {
    void call<{ staffle: StaffleView }>(`/api/staffle/${slug}`).then((r) => {
      if (r.ok) setS(r.data.staffle);
      else setError(r.error);
    });
  }, [slug]);

  // The prizes in the order they were drawn (a prize nobody won comes last).
  const order = useMemo<Item[]>(() => {
    if (!s) return [];
    const first = (i: Item) => Math.min(...i.won.map((w) => w.position), Infinity);
    return [...s.items].sort((a, b) => first(a) - first(b));
  }, [s]);
  const item = order[idx];
  const winners = item?.won ?? [];
  const drawn = !!s && (s.state === 'drawn' || s.state === 'ended');
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const draw = async () => {
    if (!s) return;
    setBusy(true);
    setError('');
    const r = await call<{ staffle: StaffleView }>(`/api/staffle/${s.slug}/draw`, 'POST');
    setBusy(false);
    if (r.ok) {
      setS(r.data.staffle);
      begin();
    } else setError(r.error);
  };
  const begin = () => {
    setStarted(true);
    setIdx(0);
    setPhase('ready');
    setShown(0);
    setWheel(null);
  };
  const next = useCallback(() => {
    setIdx((n) => n + 1);
    setPhase('ready');
    setShown(0);
    setWheel(null);
  }, []);

  // Who is in the wall: everyone who entered this prize (or, for a prize filled from the leftover pool, the winners), and who has already won an earlier prize (they are out).
  const pool = useMemo(() => [...new Set(item?.entrants.length ? item.entrants : (item?.won ?? []).map((w) => w.name))], [item]);
  const out = useMemo(() => new Set(order.slice(0, idx).flatMap((i) => i.won.map((w) => w.name))), [order, idx]);
  const gotNames = useMemo(() => new Set((item?.won ?? []).slice(0, shown).map((w) => w.name)), [item, shown]);

  // The wheel for the next pull: everyone still in (not out from an earlier prize, not already pulled for this one), and the winner somewhere on it. With a crowd it holds the winner and 35 others, mixed the same way every time.
  const wheelFor = useCallback(
    (target: string, key: number) => {
      const rest = pool
        .filter((n) => !out.has(n) && !gotNames.has(n) && n !== target)
        .sort((a, b) => hash(`${item?.id}${a}`) - hash(`${item?.id}${b}`))
        .slice(0, 35);
      return { names: [...rest, target].sort((a, b) => hash(`${item?.id}${a}`) - hash(`${item?.id}${b}`)), target, key };
    },
    [pool, out, gotNames, item],
  );
  const pull = useCallback(() => {
    const target = item?.won[shown];
    if (!target) return;
    setWheel(wheelFor(target.name, (wheel?.key ?? 0) + 1));
    setPhase('spin');
  }, [item, shown, wheelFor, wheel]);

  // The wheel turns for a while, then the winner is called.
  useEffect(() => {
    if (!started || !item || phase !== 'spin') return;
    const t = window.setTimeout(
      () => {
        setShown((n) => n + 1);
        setPhase('landed');
      },
      reduced ? 800 : WHEEL_MS + 350,
    );
    return () => window.clearTimeout(t);
  }, [started, item, phase, reduced]);
  // After a winner lands: a moment to cheer, then back to waiting for the next pull (or on to the next prize).
  useEffect(() => {
    if (!started || !item || phase !== 'landed') return;
    const total = item.won.length;
    const t = window.setTimeout(() => setPhase(shown < total ? 'ready' : 'shown'), reduced ? 600 : 1800);
    return () => window.clearTimeout(t);
  }, [started, item, phase, shown, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && started) {
        e.preventDefault();
        if (phase === 'ready' && winners.length > 0) pull();
        else if (phase === 'shown' || (phase === 'ready' && winners.length === 0)) {
          if (idx < order.length) next();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, started, phase, idx, order.length, next, pull, winners.length]);

  const done = started && idx >= order.length;
  const ph = winners.length === 0 && phase === 'ready' ? 'shown' : phase; // a prize nobody won has nothing to pull
  const pulled = winners.slice(0, ph === 'landed' ? shown - 1 : shown).filter(() => winners.length > 1 || ph !== 'shown'); // winners already out, listed under the box (the one just landed is in the box)
  return (
    <div className={styles.draw} role="dialog" aria-modal="true" aria-label="The draw">
      <button type="button" className={styles.drawClose} onClick={onClose} aria-label="Leave the draw">
        <X size={22} aria-hidden="true" />
      </button>
      {!s ? (
        error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <Loading variant="inline" label="Loading…" />
        )
      ) : !started ? (
        <div className={styles.drawIntro}>
          <small>{s.name}</small>
          <h1>{drawn ? 'Here are the winners' : 'Ready to draw'}</h1>
          <p>
            {s.items.length} {s.items.length === 1 ? 'prize' : 'prizes'} · {s.entrants} {s.entrants === 1 ? 'person' : 'people'} entered
          </p>
          {error && <Notice tone="error">{error}</Notice>}
          <Button onClick={() => (drawn ? begin() : void draw())} loading={busy}>
            {drawn ? 'Start' : 'Draw!'}
          </Button>
        </div>
      ) : done ? (
        <div className={styles.drawEnd}>
          <small>{s.name}</small>
          <h1>Congratulations!</h1>
          <ul>
            {order.map((i) => (
              <li key={i.id}>
                <b>{i.prize.name}</b>
                <span>{i.won.map((w) => w.name).join(', ') || 'No winner'}</span>
              </li>
            ))}
          </ul>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        item && (
          <div className={styles.drawStage}>
            <div className={styles.drawPrize}>
              <small>
                Prize {idx + 1} of {order.length}
              </small>
              <div className={styles.drawPic}>
                {item.prize.photo ? <ZoomImg src={item.prize.photo} alt={item.prize.name} /> : <Gift size={56} strokeWidth={1.2} aria-hidden="true" />}
              </div>
              <h2>{item.prize.name}</h2>
              <p>
                {item.winners} {item.winners === 1 ? 'winner' : 'winners'} · {item.entries} {item.entries === 1 ? 'entry' : 'entries'}
                {item.prize.sponsor ? ` · from ${item.prize.sponsor}` : ''}
              </p>
            </div>
            <div className={styles.drawArena}>
              {winners.length > 0 &&
                (() => {
                  const spec = wheel ?? wheelFor(winners[0].name, 0);
                  return <PrizeWheel key={`${item.id}:${spec.key}`} names={spec.names} target={spec.target} spinning={ph === 'spin'} reduced={reduced} />;
                })()}
              <div className={styles.spinBox} data-state={ph}>
                {ph === 'shown' && winners.length === 0 ? (
                  <span>{item.entries === 0 ? 'Nobody entered this one' : 'No winner'}</span>
                ) : ph === 'ready' ? (
                  <span className={styles.spinHint}>{shown === 0 ? 'Who will it be?' : 'Who is next?'}</span>
                ) : ph === 'spin' ? (
                  <span className={styles.spinHint}>Spinning…</span>
                ) : (
                  <span className={styles.spinWon}>{ph === 'shown' && winners.length > 1 ? `All ${winners.length} winners drawn` : (winners[shown - 1]?.name ?? '')}</span>
                )}
                {ph === 'landed' && winners[shown - 1]?.via === 'leftover' && <small className={styles.drawLeft}>from the leftover pool</small>}
                {ph === 'landed' && <Confetti seed={`${item.id}${shown}`} />}
              </div>
              {pulled.length > 0 && (
                <ul className={styles.pulled} aria-label="Winners so far">
                  {pulled.map((w, n) => (
                    <li key={w.id} style={{ '--hue': BALLS[Math.floor(hash(w.id) * BALLS.length)], '--n': n } as CSSProperties}>
                      {w.name}
                      {w.via === 'leftover' && <small> · leftover pool</small>}
                    </li>
                  ))}
                </ul>
              )}
              {pool.length > 0 && (
                <ul className={styles.wall} aria-label="Everyone who entered">
                  {pool.map((n) => (
                    <li key={n} className={`${out.has(n) ? styles.wallOut : ''} ${gotNames.has(n) ? styles.wallGot : ''}`}>
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.drawFoot}>
              {ph === 'ready' && winners.length > 0 ? (
                <Button onClick={pull}>{winners.length > 1 ? `Pull Winner ${shown + 1} Of ${winners.length}` : 'Pull The Winner'}</Button>
              ) : ph === 'shown' || ph === 'ready' ? (
                <Button onClick={next}>{idx + 1 >= order.length ? 'Show everyone' : 'Next prize'} →</Button>
              ) : (
                <span className={styles.drawHint}>{ph === 'spin' ? 'Drawing…' : ''}</span>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Confetti({ seed }: { seed: string }) {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <i
          key={i}
          style={
            {
              '--x': `${hash(`${seed}x${i}`) * 100}%`,
              '--c': BALLS[i % BALLS.length],
              '--t': `${2 + hash(`${seed}t${i}`) * 2}s`,
              '--w': `${hash(`${seed}w${i}`) * 0.6}s`,
              '--r': `${hash(`${seed}r${i}`) * 720 - 360}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
