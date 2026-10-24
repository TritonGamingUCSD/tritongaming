'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './trivia.module.css';

/** The whole-screen game views are drawn straight onto the page body, above the portal's own top bar, bell and bottom bar (which would otherwise sit on top of them on a phone). */
export function Stage({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(true); }, []);
  return on ? createPortal(children, document.body) : null;
}

// The four answers each have their own colour, letter and shape, so a player who can't tell the colours apart still knows which one they are tapping. The shape is a faint mark in the corner of the tile.
export function Shape({ i }: { i: number }) {
  const d = ['M12 3 22 20H2Z', 'M12 2 22 12 12 22 2 12Z', '', 'M4 4h16v16H4Z'][i];
  return (
    <svg className={styles.ansShape} viewBox="0 0 24 24" aria-hidden="true">
      {i === 2 ? <circle cx="12" cy="12" r="10" /> : <path d={d} />}
    </svg>
  );
}
export const ansClass = (i: number) => [styles.ans0, styles.ans1, styles.ans2, styles.ans3][i] ?? styles.ans0;
export const LETTERS = ['A', 'B', 'C', 'D'];

/** The letter on a tile (A to D), as a small paper square. */
export const Letter = ({ i }: { i: number }) => <span className={styles.ansLetter} aria-hidden="true">{LETTERS[i]}</span>;

/** A strip of tape across the top of a paper card, like on the website. */
export const Tape = () => <span className={styles.tape} aria-hidden="true" />;

// Paper falling behind the winners (the site's yellow, blue, paper and pink). Fixed positions so it looks the same on every screen; switched off for anyone who asks for less motion.
// `delay` holds it back (the podium waits for the steps to rise); `burst` is the short pop on a phone after a right answer instead of a long fall.
const BITS = Array.from({ length: 34 }, (_, i) => ({ left: `${(i * 37 + 11) % 100}%`, delay: ((i * 53) % 40) / 10, dur: 3.4 + ((i * 29) % 20) / 10, drift: ((i * 17) % 9) - 4 }));
export function Confetti({ delay = 0, burst = false }: { delay?: number; burst?: boolean }) {
  return <div className={`${styles.confetti} ${burst ? styles.confettiBurst : ''}`} aria-hidden="true">{BITS.slice(0, burst ? 18 : BITS.length).map((b, i) => <i key={i} style={{ left: b.left, animationDelay: `${delay + (burst ? b.delay / 8 : b.delay)}s`, animationDuration: `${burst ? 1.6 + b.dur / 6 : b.dur}s`, ['--drift' as string]: `${b.drift * 3}vw` }} />)}</div>;
}

/** Slow shapes drifting behind the live screens (the four answer shapes, in the site's colours). */
export function FloatShapes() {
  return (
    <div className={styles.floaters} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <svg key={i} className={styles.floater} style={{ left: `${(i * 13 + 4) % 92}%`, animationDelay: `${-i * 3.1}s`, animationDuration: `${22 + (i % 4) * 5}s`, width: `${2.2 + (i % 3)}rem`, height: `${2.2 + (i % 3)}rem` }} viewBox="0 0 24 24">
          {i % 4 === 2 ? <circle cx="12" cy="12" r="10" /> : <path d={['M12 3 22 20H2Z', 'M12 2 22 12 12 22 2 12Z', '', 'M4 4h16v16H4Z'][i % 4]} />}
        </svg>
      ))}
    </div>
  );
}

/** A number that counts up to its value (a score, points, how many chose an answer), so a change is seen happening. Shows the value at once when motion is turned down. */
export function CountUp({ value, ms = 800, from = 0, format = (n: number) => String(n) }: { value: number; ms?: number; from?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(from);
  const first = useRef(true);
  useEffect(() => {
    const calm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || value === shown && !first.current) { setShown(value); return; }
    first.current = false;
    const start = performance.now(), base = from;
    let raf = 0;
    const tick = (now: number) => { const k = Math.min(1, (now - start) / ms); const e = 1 - Math.pow(1 - k, 3); setShown(Math.round(base + (value - base) * e)); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{format(shown)}</>;
}

/** The clock as a ring that empties around the seconds left. */
export function Ring({ left, total, low }: { left: number; total: number; low: boolean }) {
  const r = 44, c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, total ? left / total : 0));
  return (
    <span className={`${styles.ring} ${low ? styles.ringLow : ''}`} aria-hidden="true">
      <svg viewBox="0 0 100 100"><circle className={styles.ringTrack} cx="50" cy="50" r={r} /><circle className={styles.ringFill} cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - k)} transform="rotate(-90 50 50)" /></svg>
      <b>{Math.ceil(left / 1000)}</b>
    </span>
  );
}

export const fmtScore = (n: number) => n.toLocaleString('en-US');
export const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`; };

/** The card shown before a question that has a category: the category, big, for a few seconds. The question and its clock come after it. */
export function CategoryCard({ category, n, total }: { category: string; n: number; total: number }) {
  return (
    <div className={styles.categoryCard} role="status" aria-label={`Category: ${category}`}>
      <Tape />
      <p className={styles.kicker}>Question {n} of {total}</p>
      <p className={styles.categoryName}>{category}</p>
    </div>
  );
}
