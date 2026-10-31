'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import styles from './meetings.module.css';
import { TodayMeeting } from './types';
import { timeRange } from './format';
import { useNow } from './hooks';

// On every other tab: what is on today, one slim line, so a host never has to go looking for it.
export function TodayStrip({ canHost, onHost, onMine }: { canHost: boolean; onHost: (id: string) => void; onMine: () => void }) {
  const [list, setList] = useState<TodayMeeting[]>([]);
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings/today', { cache: 'no-store' });
      if (res.ok) setList((await res.json()).meetings ?? []);
    } catch {
      /* keep what we have */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useVisiblePoll(load, 60_000);
  const now = useNow();
  const today = list.filter((m) => new Date(m.ends_at).getTime() > now);
  if (!today.length) return null;
  return (
    <ul className={styles.todayStrip} aria-label="Today">
      {today.map((m) => (
        <li key={m.id}>
          <span className={`${styles.todayDot} ${m.accepting ? styles.todayDotOpen : ''}`} aria-hidden="true" />
          <span className={styles.todayText}>
            <strong>Today: {m.title}</strong> {timeRange(m.starts_at, m.ends_at)}
            {m.accepting ? ' · Check-in open' : m.open ? ' · Opens soon' : ''}
          </span>
          {canHost ? (
            <Button size="sm" variant="secondary" onClick={() => onHost(m.id)}>
              Open Live Screen
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onMine}>
              Check In
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
