'use client';

import { useMemo } from 'react';
import styles from './photobooth.module.css';

const COLOURS = ['#facc15', '#38bdf8', '#f472b6', '#34d399', '#fb923c', '#a78bfa', '#ffffff'];

/** A pseudo-random number from a seed (the confetti is the same on every draw of the same piece, so it does not jump when the screen redraws). */
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

// A burst of falling paper bits for the happy moments (the finished picture, the QR code). Pure CSS motion: each bit has its own place, delay, fall time and turn. Not shown to people who ask for less motion.
export function Confetti({ count = 46 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: rand(i + 1) * 100,
        delay: rand(i + 50) * 0.6,
        fall: 2.2 + rand(i + 99) * 1.6,
        spin: (rand(i + 7) - 0.5) * 900,
        drift: (rand(i + 31) - 0.5) * 18,
        colour: COLOURS[i % COLOURS.length],
        wide: 0.35 + rand(i + 13) * 0.45,
      })),
    [count],
  );
  return (
    <div className={styles.confetti} aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={
            {
              left: `${b.left}%`,
              background: b.colour, // theme-ok
              width: `${b.wide}rem`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.fall}s`,
              ['--spin' as string]: `${b.spin}deg`,
              ['--drift' as string]: `${b.drift}vw`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
