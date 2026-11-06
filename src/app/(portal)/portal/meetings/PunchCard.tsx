'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { dayLabel } from './format';
import styles from './punchCard.module.css';

interface Row {
  id: string;
  title: string;
  date: string;
  attended: boolean;
  checked_in_at: string | null;
}

const SLOTS = 10;

// Your attendance as a punch card: the last ten meetings are ten slots, a meeting you checked in to is a stamp, one you missed is an empty ring, and the slots that are left wait for the next meetings.
// A check-in made in the last minute stamps itself on with a little slam.
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

  const recent = data.meetings.slice(0, SLOTS).reverse(); // oldest first, so the newest stamp is the last one
  const slots: (Row | null)[] = [...recent, ...Array.from({ length: SLOTS - recent.length }, () => null)];
  const got = recent.filter((m) => m.attended).length;
  const perfect = recent.length === SLOTS && got === SLOTS;
  const fresh = (m: Row) => !!m.checked_in_at && Date.now() - new Date(m.checked_in_at).getTime() < 90_000;
  return (
    <section className={`${styles.card} ${perfect ? styles.perfect : ''}`} aria-label="Attendance card">
      <header className={styles.head}>
        <span className={styles.brand}>Triton Gaming</span>
        <h2 className={styles.title}>Attendance Card</h2>
        <span className={styles.tally}>
          <b>{got}</b>/{SLOTS}
        </span>
      </header>
      <ol className={styles.slots}>
        {slots.map((m, i) => (
          <li key={m?.id ?? `empty-${i}`} className={`${styles.slot} ${m?.attended ? styles.stamped : m ? styles.missed : styles.waiting}`}>
            {m?.attended ? (
              <span className={`${styles.stamp} ${fresh(m) ? styles.slam : ''}`} style={{ ['--tilt' as string]: `${((i * 7) % 11) - 5}deg` }}>
                <Check size={20} strokeWidth={3} aria-hidden="true" />
              </span>
            ) : (
              <span className={styles.ring} aria-hidden="true">
                {m ? '–' : i + 1}
              </span>
            )}
            <small>{m ? dayLabel(m.date).replace(/^\w+, /, '') : ''}</small>
            <span className="sr-only">{m ? `${m.title}: ${m.attended ? 'checked in' : 'missed'}` : 'Not yet'}</span>
          </li>
        ))}
      </ol>
      <footer className={styles.foot}>
        {perfect
          ? 'A full card! Perfect attendance.'
          : got === 0
            ? 'Check in at a meeting to get your first stamp.'
            : `${SLOTS - got} more stamp${SLOTS - got === 1 ? '' : 's'} for a full card.`}
      </footer>
    </section>
  );
}
