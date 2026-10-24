'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
const BITS = Array.from({ length: 30 }, (_, i) => ({ left: `${(i * 37 + 11) % 100}%`, delay: `${((i * 53) % 40) / 10}s`, dur: `${3.4 + ((i * 29) % 20) / 10}s` }));
export function Confetti() {
  return <div className={styles.confetti} aria-hidden="true">{BITS.map((b, i) => <i key={i} style={{ left: b.left, animationDelay: b.delay, animationDuration: b.dur }} />)}</div>;
}

export const fmtScore = (n: number) => n.toLocaleString('en-US');
export const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`; };
