'use client';

import { useState } from 'react';
import styles from './meetings.module.css';
import { MARK_LABEL, dayLabel } from './format';
import { Avatar } from './Avatar';
import { AttPerson } from './types';

// One person's row: dots and a bar at a glance; tap the name for the meetings behind them.
export function PersonRow({ p, meetings }: { p: AttPerson; meetings: { id: string; title: string; meeting_date: string }[] }) {
  const [open, setOpen] = useState(false);
  const history = meetings
    .map((m, i) => ({ m, mark: p.marks[i] }))
    .filter((x) => x.mark && x.mark !== '-')
    .reverse();
  return (
    <li className={styles.attRow}>
      <Avatar p={p} />
      <button type="button" className={styles.attMain} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.personName}>
          {p.name}
          {p.follow_up && <b className={styles.flag}>Follow up</b>}
        </span>
        <em className={styles.attSub}>
          {p.role}
          {p.streak >= 2 ? ` · ${p.streak} in a row` : ''}
          {p.missedRun >= 2 ? ` · missed last ${p.missedRun}` : ''}
          {p.last_attended ? ` · last ${dayLabel(p.last_attended)}` : ' · never attended'}
        </em>
      </button>
      <span className={styles.dots} aria-label="Their last meetings, oldest to newest">
        {p.marks
          .filter((m) => m !== '-')
          .slice(-12)
          .map((m, i) => (
            <i key={i} className={m === 'p' ? styles.dotP : m === 'a' ? styles.dotA : m === 'e' ? styles.dotE : m === 'g' ? styles.dotG : styles.dotN} />
          ))}
      </span>
      <span className={styles.attRate}>
        <span className={styles.bar} title={p.rate !== null ? `${p.attended} of ${p.total} (${Math.round(p.rate * 100)}%)` : 'No meetings yet'}>
          <span style={{ width: `${(p.rate ?? 0) * 100}%` }} />
        </span>
      </span>
      {open && (
        <ul className={styles.personHistory}>
          {history.length === 0 ? (
            <li>No meetings for them in this range.</li>
          ) : (
            history.slice(0, 20).map(({ m, mark }) => (
              <li key={m.id} data-mark={mark}>
                <span>{dayLabel(m.meeting_date)}</span>
                <span>{m.title}</span>
                <b>{MARK_LABEL[mark] ?? ''}</b>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}
