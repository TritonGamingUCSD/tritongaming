'use client';

import { useEffect, useState } from 'react';
import styles from './PageBlocks.module.css';

// "Doors open in 3d 4h 12m". Ticks once a second while it is on screen; with "reduce motion" on it updates once a minute. After the time it shows the "after" line (or nothing).
export default function CountdownBlock({ label, at, after }: { label: string; at: string; after: string }) {
  const target = Date.parse(at);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), slow ? 60_000 : 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : Math.max(0, target - now);
  if (left === 0) return after ? <p className={styles.countAfter}>{after}</p> : null;
  const s = left === null ? 0 : Math.floor(left / 1000);
  const parts = [
    { n: Math.floor(s / 86400), l: 'days' },
    { n: Math.floor((s % 86400) / 3600), l: 'hours' },
    { n: Math.floor((s % 3600) / 60), l: 'minutes' },
    { n: s % 60, l: 'seconds' },
  ];
  return (
    <div className={styles.count} role="timer" aria-label={label ? `${label}: ${parts[0].n} days ${parts[1].n} hours ${parts[2].n} minutes` : undefined}>
      {label && <span className={styles.countLabel}>{label}</span>}
      <div className={styles.countRow} aria-hidden="true">
        {parts.map((p) => (
          <div key={p.l} className={styles.countCell}>
            <b>{left === null ? '–' : String(p.n).padStart(2, '0')}</b>
            <span>{p.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
