'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Flame, X } from 'lucide-react';
import { dayLabel } from './format';
import styles from './punchCard.module.css';

interface Row {
  id: string;
  title: string;
  date: string;
  attended: boolean;
  checked_in_at: string | null;
}

const SHOWN = 10;

// Your attendance, said plainly: a big percentage, one sentence, your streak, and a square for each of the last meetings (green you came, red you missed). A check-in made in the last minute pops in.
export default function PunchCard() {
  const [data, setData] = useState<{ meetings: Row[]; attended: number; total: number } | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/meetings/mine', { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {
      /* keep what we have */
    }
  }, []);
  useEffect(() => {
    void load();
    const f = () => void load();
    window.addEventListener('tg:meetings-changed', f);
    return () => window.removeEventListener('tg:meetings-changed', f);
  }, [load]);
  if (!data || data.meetings.length === 0) return null;

  const newestFirst = data.meetings;
  const recent = newestFirst.slice(0, SHOWN).reverse(); // oldest to newest, so the newest is on the right
  const came = recent.filter((m) => m.attended).length;
  const pct = Math.round((came / recent.length) * 100);
  let streak = 0;
  for (const m of newestFirst) {
    if (!m.attended) break;
    streak++;
  }
  const fresh = (m: Row) => !!m.checked_in_at && Date.now() - new Date(m.checked_in_at).getTime() < 90_000;
  return (
    <section className={styles.card} aria-label="Your attendance">
      <div className={styles.top}>
        <div className={styles.big} aria-hidden="true">
          {pct}
          <small>%</small>
        </div>
        <div className={styles.say}>
          <h2>
            You came to {came} of the last {recent.length} meeting{recent.length === 1 ? '' : 's'}
          </h2>
          {streak >= 2 ? (
            <p className={styles.streak}>
              <Flame size={15} aria-hidden="true" /> {streak} in a row
            </p>
          ) : (
            <p className={styles.sub}>{streak === 1 ? 'You made the latest one.' : 'Come to the next one to start a streak.'}</p>
          )}
        </div>
      </div>
      <ol className={styles.squares}>
        {recent.map((m) => (
          <li
            key={m.id}
            className={`${styles.sq} ${m.attended ? styles.came : styles.missed} ${fresh(m) ? styles.pop : ''}`}
            title={`${m.title}: ${m.attended ? 'you came' : 'you missed it'}`}
          >
            <span className={styles.mark}>{m.attended ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <X size={16} strokeWidth={3} aria-hidden="true" />}</span>
            <small>{dayLabel(m.date).replace(/^\w+, /, '')}</small>
            <span className="sr-only">{`${m.title}: ${m.attended ? 'you came' : 'you missed it'}`}</span>
          </li>
        ))}
      </ol>
      <p className={styles.key}>
        <i className={styles.dotCame} /> Came <i className={styles.dotMissed} /> Missed · oldest to newest
      </p>
    </section>
  );
}
