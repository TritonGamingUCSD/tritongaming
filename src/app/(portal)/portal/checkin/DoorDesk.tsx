'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import { formatPacificTime } from '@/lib/core/timezone';
import styles from './doorDesk.module.css';

interface DeskEvent {
  id: string;
  title: string;
  slug?: string | null;
  start_date: string;
  end_date?: string | null;
}
interface TicketRow {
  id: string;
  status: string;
  checked_in_at: string | null;
  user: { display_name: string | null } | { display_name: string | null }[] | null;
}

const nameOf = (t: TicketRow) => (Array.isArray(t.user) ? t.user[0] : t.user)?.display_name || 'Guest';

// The door desk: a scoreboard of how many people are in, a show-up rate, and a ticker of the last people through the door. It refreshes itself while staff work the door.
export default function DoorDesk({ events }: { events: DeskEvent[] }) {
  const now = Date.now();
  const onNow = events.find((e) => new Date(e.start_date).getTime() <= now && new Date(e.end_date ?? e.start_date).getTime() >= now);
  const [id, setId] = useState((onNow ?? events[0])?.id);
  const ev = events.find((e) => e.id === id) ?? events[0];
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [bump, setBump] = useState(0);
  const lastIn = useRef(-1);
  const load = useCallback(async () => {
    if (!ev) return;
    try {
      const r = await fetch(`/api/events/${ev.slug ?? ev.id}/checkins`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = (await r.json()) as { tickets: TicketRow[] };
      const inNow = j.tickets.filter((t) => t.status === 'used').length;
      if (lastIn.current >= 0 && inNow > lastIn.current) setBump((n) => n + 1);
      lastIn.current = inNow;
      setTickets(j.tickets);
    } catch {
      /* keep what we have */
    }
  }, [ev]);
  useEffect(() => {
    lastIn.current = -1;
    setTickets(null);
    void load();
  }, [load]);
  useVisiblePoll(load, 8_000);
  if (!ev) return null;

  const active = (tickets ?? []).filter((t) => t.status === 'active' || t.status === 'used');
  const inCount = active.filter((t) => t.status === 'used').length;
  const rate = active.length ? Math.round((inCount / active.length) * 100) : 0;
  const recent = active
    .filter((t) => t.checked_in_at)
    .sort((a, b) => b.checked_in_at!.localeCompare(a.checked_in_at!))
    .slice(0, 8);
  const digits = String(inCount).padStart(3, '0').split('');
  const live = !!onNow && onNow.id === ev.id;
  return (
    <section className={styles.desk} aria-label="Door desk">
      <header className={styles.top}>
        <span className={`${styles.badge} ${live ? styles.on : ''}`}>{live ? 'Door open' : 'Door desk'}</span>
        {events.length > 1 ? (
          <select className={styles.pick} value={ev.id} onChange={(e) => setId(e.target.value)} aria-label="Event at the door">
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        ) : (
          <strong className={styles.name}>{ev.title}</strong>
        )}
      </header>
      <div className={styles.board}>
        <div className={styles.counter} aria-label={`${inCount} people in`}>
          <div className={styles.digits}>
            {digits.map((d, i) => (
              <span key={`${i}-${d}-${bump}`} className={`${styles.digit} ${d !== '0' || i === 2 ? '' : styles.dim}`}>
                {d}
              </span>
            ))}
          </div>
          <span className={styles.label}>In the door</span>
        </div>
        <div className={styles.stat}>
          <b>{tickets === null ? '–' : active.length}</b>
          <span>Registered</span>
        </div>
        <div className={styles.stat}>
          <b>{tickets === null ? '–' : `${rate}%`}</b>
          <span>Showed up</span>
        </div>
      </div>
      <div className={styles.rail} role="img" aria-label={`${rate} percent of registered people are in`}>
        <span style={{ width: `${rate}%` }} />
      </div>
      <div className={styles.ticker}>
        <span className={styles.tickLabel}>Last through the door</span>
        {recent.length === 0 ? (
          <span className={styles.empty}>{tickets === null ? 'Loading…' : 'Nobody yet. The first scan shows up here.'}</span>
        ) : (
          <ul className={styles.chips}>
            {recent.map((t) => (
              <li key={t.id} className={styles.chip}>
                <i>{nameOf(t).slice(0, 1).toUpperCase()}</i>
                <span>{nameOf(t)}</span>
                <small>{formatPacificTime(t.checked_in_at!)}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
