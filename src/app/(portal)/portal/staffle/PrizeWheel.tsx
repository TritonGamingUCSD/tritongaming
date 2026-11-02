'use client';

import { useEffect, useState } from 'react';
import styles from './staffle.module.css';

// How long a spin lasts (the draw screen waits this long before it calls the winner).
export const WHEEL_MS = 5600;
const COLORS: [string, string][] = [
  ['#ffc72c', '#0a1230'],
  ['#7db4ea', '#0a1230'],
  ['#2fae86', '#06251c'],
  ['#d9487f', '#fff'],
  ['#e8912d', '#0a1230'],
  ['#8b6cdc', '#fff'],
  ['#f2f1f0', '#0a1230'],
]; /* theme-ok */
const point = (deg: number, r: number) => `${(r * Math.sin((deg * Math.PI) / 180)).toFixed(2)} ${(-r * Math.cos((deg * Math.PI) / 180)).toFixed(2)}`;
const clip = (n: string, max: number) => (n.length > max ? `${n.slice(0, max - 1)}…` : n);

// The prize wheel: one slice per name, a pointer at the top. When `spinning` it turns several times and slows down until the slice of `target` is under the pointer; otherwise it stays where it is.
// The draw screen gives each pull its own `key`, so a new wheel always starts from the top.
export default function PrizeWheel({ names, target, spinning, reduced }: { names: string[]; target: string; spinning: boolean; reduced: boolean }) {
  const [deg, setDeg] = useState(0);
  const n = Math.max(1, names.length);
  const step = 360 / n;
  useEffect(() => {
    if (!spinning) return;
    const t = Math.max(0, names.indexOf(target));
    const jitter = (Math.random() - 0.5) * step * 0.6; // stops somewhere inside the slice, not always on its middle
    const id = requestAnimationFrame(() => setDeg((reduced ? 360 : 360 * 6) - (t + 0.5) * step + jitter));
    return () => cancelAnimationFrame(id);
  }, [spinning, names, target, step, reduced]);
  const fs = Math.min(7.5, Math.max(3.4, 320 / n));
  return (
    <div className={styles.wheel} aria-hidden="true">
      <svg viewBox="-120 -120 240 240">
        <g
          style={{ transform: `rotate(${deg}deg)`, transition: spinning && !reduced ? `transform ${WHEEL_MS}ms cubic-bezier(0.14, 0.62, 0.12, 1)` : 'none' }}
          className={styles.wheelDisc}
        >
          <circle r="104" fill="#0a1230" /> {/* theme-ok */}
          {names.length === 1 ? (
            <circle r="100" fill={COLORS[0][0]} />
          ) : (
            names.map((name, i) => {
              const [bg] = COLORS[i % COLORS.length];
              return (
                <path
                  key={name}
                  d={`M0 0 L${point(i * step, 100)} A100 100 0 0 1 ${point((i + 1) * step, 100)} Z`}
                  fill={i === names.length - 1 && names.length % COLORS.length === 1 ? COLORS[2][0] : bg}
                  stroke="#0a1230"
                  strokeWidth="0.8"
                />
              ); /* theme-ok */
            })
          )}
          {names.map((name, i) => {
            const c = (i + 0.5) * step;
            const [, ink] = COLORS[i % COLORS.length];
            return (
              <text
                key={name}
                transform={`rotate(${c - 90}) translate(26 0)`}
                fontSize={fs}
                fontWeight="800"
                fill={i === names.length - 1 && names.length % COLORS.length === 1 ? COLORS[2][1] : ink}
                dominantBaseline="middle"
                fontFamily="inherit"
              >
                {clip(name, n > 24 ? 9 : 16)}
              </text>
            );
          })}
          <circle r="11" fill="#0a1230" stroke="#ffc72c" strokeWidth="3" /> {/* theme-ok */}
        </g>
        <path d="M0 -90 L-10 -114 L10 -114 Z" fill="#ffc72c" stroke="#0a1230" strokeWidth="2.5" strokeLinejoin="round" /> {/* theme-ok */}
      </svg>
    </div>
  );
}
