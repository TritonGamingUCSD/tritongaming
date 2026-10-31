'use client';

import Loading from '@/components/Loading/Loading';
import { useEffect, useState } from 'react';
import Notice from '@/components/ui/Notice';
import styles from './meetings.module.css';
import { dayLabel, time } from './format';
import { DocButton } from './DocButton';

export function MyHistoryPanel() {
  const [data, setData] = useState<{
    meetings: {
      id: string;
      title: string;
      date: string;
      location: string | null;
      attended: boolean;
      checked_in_at: string | null;
      method: string | null;
      doc_url: string | null;
    }[];
    attended: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meetings/mine', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) setError(json.error || 'Failed to load.');
        else setData(json);
      } catch {
        setError('Network error.');
      }
    })();
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <Loading label="Loading your history…" />;
  if (data.meetings.length === 0)
    return (
      <div className={styles.card}>
        <p className={styles.muted}>No meetings yet.</p>
      </div>
    );

  const pct = data.total ? Math.round((data.attended / data.total) * 100) : 0;
  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          You&apos;ve been to {data.attended} of the last {data.total} meeting{data.total === 1 ? '' : 's'}
        </h2>
        <div className={styles.meter}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className={styles.people}>
        {data.meetings.map((m) => (
          <li key={m.id} className={`${styles.historyRow} ${m.attended ? '' : styles.missed}`}>
            <span className={styles.recentName}>
              <strong>{m.title}</strong>
              <span>
                {dayLabel(m.date)} ·{' '}
                {m.attended ? `checked in ${time(m.checked_in_at!)}${m.method === 'manual' ? ' (added by exec)' : m.method === 'host' ? ' (host)' : ''}` : 'not checked in'}
              </span>
            </span>
            {m.doc_url && <DocButton url={m.doc_url} label="Doc" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
