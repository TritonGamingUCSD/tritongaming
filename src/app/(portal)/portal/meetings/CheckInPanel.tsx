'use client';

import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import styles from './meetings.module.css';
import { NextMeeting, TodayMeeting } from './types';
import { dayLabel, time, timeRange } from './format';
import { DocButton } from './DocButton';
import { FunBox } from './FunBox';

// ── A team member checking themselves in ──────────────────────────────────────
export function CheckInPanel() {
  const [data, setData] = useState<{ meetings: TodayMeeting[]; next: NextMeeting | null } | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings/today', { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      /* keep what we have */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  // The scanner in the phone's bottom bar checked someone in: show it.
  useEffect(() => {
    const f = () => void load();
    window.addEventListener('tg:meetings-changed', f);
    return () => window.removeEventListener('tg:meetings-changed', f);
  }, [load]);
  useVisiblePoll(load, 60_000); // paused while the tab is hidden; refreshes the moment it comes back
  // A meeting is over at its scheduled end: its cards go away right then, without waiting for the next refresh.
  const [, tick] = useState(0);
  useEffect(() => {
    const next = (data?.meetings ?? [])
      .map((m) => new Date(m.ends_at).getTime())
      .filter((t) => t > Date.now())
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const id = setTimeout(() => tick((n) => n + 1), Math.min(next - Date.now() + 250, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, [data]);

  if (!data) return <Loading label="Loading meetings…" />;

  const meetings = data.meetings.filter((m) => new Date(m.ends_at).getTime() > Date.now());
  const checkedIn = meetings.filter((m) => m.checked_in_at);
  const openToEnter = meetings.filter((m) => m.accepting && !m.checked_in_at);
  // Opened by an exec, but members can't start yet (it's earlier than 10 minutes before the start).
  const early = meetings.filter((m) => m.open && !m.accepting && !m.checked_in_at);

  return (
    <div className={styles.stack}>
      {checkedIn.map((m) => (
        <div key={m.id} className={`${styles.card} ${styles.done}`}>
          <div className={styles.doneHead}>
            <span className={styles.doneIcon}>
              <Check size={22} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div className={styles.doneText}>
              <h2 className={styles.cardTitle}>You&apos;re checked in</h2>
              <p className={styles.muted}>
                {m.title} · {time(m.checked_in_at!)}
                {m.location ? ` · ${m.location}` : ''}
              </p>
            </div>
          </div>
          {m.doc_url && <DocButton url={m.doc_url} />}
          <FunBox meeting={m} onSaved={load} />
        </div>
      ))}

      {openToEnter.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{checkedIn.length > 0 ? 'Another meeting? Enter its code' : 'Enter the code on the screen'}</h2>
          <p className={styles.muted}>{openToEnter.length === 1 ? `${openToEnter[0].title} · ` : 'The code decides which meeting you join · '}the code changes every 30 s</p>
          {openToEnter.length === 1 && openToEnter[0].doc_url && <DocButton url={openToEnter[0].doc_url} label="Open meeting doc" />}
          <p className={styles.muted}>Type the code in the Enter A Code box in the sidebar (on a phone, use the Scan button).</p>
        </div>
      )}

      {early.length > 0 && openToEnter.length === 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Check-in opens at {time(early[0].opens_at)}</h2>
          <p className={styles.muted}>
            {early[0].title} · starts {time(early[0].starts_at)}
          </p>
          {early[0].doc_url && <DocButton url={early[0].doc_url} />}
        </div>
      )}

      {checkedIn.length === 0 && openToEnter.length === 0 && early.length === 0 && (
        <div className={styles.slimLine}>
          <strong>Check-in isn&apos;t open</strong>
          <span>{meetings.length > 0 ? 'It opens when the meeting starts. This page updates itself.' : 'There’s no meeting today.'}</span>
          {meetings
            .filter((m) => m.doc_url)
            .map((m) => (
              <DocButton key={m.id} url={m.doc_url!} label={meetings.length > 1 ? `Doc: ${m.title}` : 'Meeting doc'} />
            ))}
        </div>
      )}

      {data.next && (
        <div className={styles.nextCard}>
          <span className={styles.nextLabel}>Next meeting</span>
          <strong>{data.next.title}</strong>
          <span className={styles.muted}>
            {dayLabel(data.next.date, true)} · {timeRange(data.next.starts_at, data.next.ends_at)}
            {data.next.location ? ` · ${data.next.location}` : ''}
          </span>
          {data.next.doc_url && <DocButton url={data.next.doc_url} />}
        </div>
      )}
    </div>
  );
}
