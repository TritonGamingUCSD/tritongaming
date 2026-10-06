'use client';

import { useEffect, useState } from 'react';
import styles from './dashboardHome.module.css';

// Time left until an event starts, as boxes: days, hours, minutes. Counts down live, a minute at a time; once it starts it says so.
export default function EventCountdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState<number | null>(null);   // null until mounted, so the server and the browser agree on what is drawn first
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return <div className={styles.countdown} aria-hidden="true" />;
  const ms = new Date(startsAt).getTime() - now;
  if (ms <= 0) return <p className={styles.countdownNow} role="status">Happening now</p>;
  const mins = Math.floor(ms / 60_000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const parts: [number, string][] = [[d, 'days'], [h, 'hours'], [m, 'min']];
  return (
    <div className={styles.countdown} role="timer" aria-label={`Starts in ${d} days, ${h} hours and ${m} minutes`}>
      <span className={styles.countLead}>Starts in</span>
      {parts.map(([n, label]) => <span key={label} className={styles.countBox}><b>{String(n).padStart(2, '0')}</b><small>{label}</small></span>)}
    </div>
  );
}
