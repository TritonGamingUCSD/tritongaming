'use client';

import { useEffect, useState } from 'react';
import type { DivisionHat } from '@/components/portal/hubTypes';
import type { DivisionEventRow } from '@/app/api/divisions/[id]/events/route';
import { formatPacificDateTime } from '@/lib/core/timezone';
import styles from './divisionAttendance.module.css';

// Attendance of the division's recent events on its Home: big totals, then a bar per event (registered behind, checked in in front). Members and Heads see it (the same numbers as the Events page).
export default function DivisionAttendance({ hat }: { hat: DivisionHat }) {
  const [rows, setRows] = useState<DivisionEventRow[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/divisions/${hat.id}/events`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((j) => {
        if (!live) return;
        const now = Date.now();
        const past = (j.events as DivisionEventRow[]).filter((e) => new Date(e.end_date ?? e.start_date).getTime() < now && e.registered > 0);
        setRows(past.sort((a, b) => b.start_date.localeCompare(a.start_date)));
      })
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [hat.id]);
  if (!rows || rows.length === 0) return null;
  const recent = rows.slice(0, 8).reverse();
  const max = Math.max(...recent.map((e) => e.registered), 1);
  const came = rows.reduce((n, e) => n + e.checkedIn, 0);
  const reg = rows.reduce((n, e) => n + e.registered, 0);
  const rate = reg ? Math.round((came / reg) * 100) : 0;
  return (
    <section className={styles.wrap} aria-label="Attendance">
      <h3 className={styles.title}>Attendance</h3>
      <div className={styles.totals}>
        <div>
          <b>{rows.length}</b>
          <span>Events held</span>
        </div>
        <div>
          <b>{came}</b>
          <span>Check-ins</span>
        </div>
        <div>
          <b>{rate}%</b>
          <span>Showed up</span>
        </div>
      </div>
      <ul className={styles.bars}>
        {recent.map((e) => (
          <li key={e.id} className={styles.row}>
            <span className={styles.name}>
              {e.title}
              <small>{formatPacificDateTime(e.start_date, { weekday: false })}</small>
            </span>
            <span className={styles.track} role="img" aria-label={`${e.checkedIn} of ${e.registered} came`}>
              <span className={styles.reg} style={{ width: `${(e.registered / max) * 100}%` }}>
                <span className={styles.in} style={{ width: `${e.registered ? (e.checkedIn / e.registered) * 100 : 0}%` }} />
              </span>
            </span>
            <span className={styles.n}>
              {e.checkedIn}/{e.registered}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
