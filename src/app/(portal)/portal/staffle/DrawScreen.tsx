'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Gift, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { call, type StaffleView } from './api';
import styles from './staffle.module.css';

type Item = StaffleView['items'][number];
const BALLS = ['#ffc72c', '#e8912d', '#d9487f', '#7db4ea', '#2fae86', '#8b6cdc', '#f2f1f0', '#e5484d']; /* theme-ok */
const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
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

// The draw, full screen for a projector. Staff press Draw: the winners are worked out and saved on the server first (so a reload shows the same), then each prize comes up in turn with a lottery: a drum of balls
// (one per person who entered) tumbles, then a ball drops out and opens on the winner's name. Space, Enter or → goes on to the next prize; Esc leaves.
export default function DrawScreen({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [s, setS] = useState<StaffleView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'rolling' | 'reveal' | 'shown'>('rolling');
  const [shown, setShown] = useState(0);
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
  const winners = (item?.won ?? []).filter((w) => !w.passed);
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
    setPhase('rolling');
    setShown(0);
  };
  const next = useCallback(() => {
    setIdx((n) => n + 1);
    setPhase('rolling');
    setShown(0);
  }, []);

  // The timeline of one prize: the drum rolls, then the winners drop out one after another, then it waits for "Next".
  useEffect(() => {
    if (!started || !item) return;
    const timers: number[] = [];
    if (phase === 'rolling') timers.push(window.setTimeout(() => setPhase('reveal'), reduced ? 500 : 3800));
    if (phase === 'reveal') {
      if (winners.length === 0) timers.push(window.setTimeout(() => setPhase('shown'), 1500));
      else if (shown < winners.length) timers.push(window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 200 : reduced ? 400 : 1700));
      else timers.push(window.setTimeout(() => setPhase('shown'), 600));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [started, item, phase, shown, winners.length, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && started && phase === 'shown') {
        e.preventDefault();
        if (idx < order.length) next();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, started, phase, idx, order.length, next]);

  const done = started && idx >= order.length;
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
                <span>
                  {i.won
                    .filter((w) => !w.passed)
                    .map((w) => w.name)
                    .join(', ') || 'No winner'}
                </span>
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
                {item.prize.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.prize.photo} alt="" />
                ) : (
                  <Gift size={56} strokeWidth={1.2} aria-hidden="true" />
                )}
              </div>
              <h2>{item.prize.name}</h2>
              <p>
                {item.winners} {item.winners === 1 ? 'winner' : 'winners'} · {item.entries} {item.entries === 1 ? 'entry' : 'entries'}
                {item.prize.sponsor ? ` · from ${item.prize.sponsor}` : ''}
              </p>
            </div>
            <div className={styles.drawArena}>
              {phase === 'rolling' && <Drum names={item.entrants} />}
              {phase !== 'rolling' && (
                <div className={styles.drawWinners} data-count={winners.length}>
                  {winners.length === 0 && <div className={styles.drawNobody}>{item.entries === 0 ? 'Nobody entered this one' : 'No winner'}</div>}
                  {winners.slice(0, shown).map((w, n) => (
                    <div key={w.id} className={styles.drawBall} style={{ '--hue': BALLS[Math.floor(hash(w.id) * BALLS.length)], '--n': n } as CSSProperties}>
                      <span className={styles.drawBallName}>{w.name}</span>
                    </div>
                  ))}
                  {winners.length > 0 && shown >= winners.length && <Confetti seed={item.id} />}
                </div>
              )}
            </div>
            <div className={styles.drawFoot}>
              {phase === 'shown' ? (
                <Button onClick={next}>{idx + 1 >= order.length ? 'Show everyone' : 'Next prize'} →</Button>
              ) : (
                <span className={styles.drawHint}>{phase === 'rolling' ? 'Drawing…' : ''}</span>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// The drum: a ring of balls, one per person who entered (at least a dozen so it is never sparse), each tumbling on its own path.
function Drum({ names }: { names: string[] }) {
  const balls = useMemo(() => {
    const list = names.length ? names : ['?'];
    const out: string[] = [];
    while (out.length < 14) out.push(...list);
    return out.slice(0, Math.max(14, Math.min(40, list.length)));
  }, [names]);
  return (
    <div className={styles.drum} aria-hidden="true">
      {balls.map((n, i) => {
        // Three spots inside the drum for the ball to roll between (polar, so none is outside the circle), in units of the drum's own width.
        const spot = (k: number) => {
          const a = hash(`${n}${i}a${k}`) * Math.PI * 2,
            r = (0.3 + hash(`${n}${i}r${k}`) * 0.7) * 37;
          return [`${(Math.cos(a) * r).toFixed(1)}cqw`, `${(Math.sin(a) * r).toFixed(1)}cqw`];
        };
        const [p1, p2, p3] = [spot(1), spot(2), spot(3)];
        return (
          <span
            key={i}
            className={styles.drumBall}
            style={
              {
                '--hue': BALLS[i % BALLS.length],
                '--x1': p1[0],
                '--y1': p1[1],
                '--x2': p2[0],
                '--y2': p2[1],
                '--x3': p3[0],
                '--y3': p3[1],
                '--d': `${0.45 + hash(`${n}${i}d`) * 0.5}s`,
                '--w': `${-hash(`${n}${i}w`)}s`,
              } as CSSProperties
            }
          >
            {initials(n)}
          </span>
        );
      })}
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
