'use client';

import { Check, Circle } from 'lucide-react';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import { groupByArea, type ShiftGrid } from '@/lib/shifts/shifts';
import styles from './shifts.module.css';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });

/** Exec: for the event picked above, each station's checklist: what got done, by whom and when, and what never did. */
export default function ChecklistSummary({ grid }: { grid: ShiftGrid }) {
  const stations = groupByArea(grid.stations).flatMap((g) => g.stations).filter((s) => (grid.checklists[s.id] ?? []).length > 0);
  if (stations.length === 0) return <div className={styles.card}><p className={styles.muted}>No station has a checklist for this event. Add one in Setup → Guides.</p></div>;
  const all = stations.flatMap((s) => grid.checklists[s.id]);
  const done = all.filter((i) => i.done_at).length;
  return (
    <div className={styles.card}>
      <h3 className={styles.h}>Checklists <span className={styles.muted}>{done}/{all.length} done</span></h3>
      <div className={styles.sumGrid}>
        {stations.map((s) => {
          const items = grid.checklists[s.id];
          const n = items.filter((i) => i.done_at).length;
          return (
            <section key={s.id} className={styles.sumStation} aria-label={s.name}>
              <h4>{s.name} <span className={n === items.length ? styles.ok : styles.short}>{n}/{items.length}</span></h4>
              <ul>
                {items.map((i) => (
                  <li key={i.id}>
                    {i.done_at ? <Check size={14} className={styles.ok} aria-label="Done" /> : <Circle size={14} className={styles.short} aria-label="Not done" />}
                    <span>{i.label}</span>
                    {i.done_at && <small className={styles.muted}>{i.done_by_name}, {time(i.done_at)}</small>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
