'use client';

import { useMemo } from 'react';
import type { PlanApi } from './usePlans';
import styles from './logistics.module.css';

// Once an event is closed: for each prize, how many were promised to its pools, how many were given out and how many are left over. A sponsor's prize that is left over is to take back or return.
export default function PrizeWrapUp({ plan }: { plan: PlanApi }) {
  const { lines, done, steps } = plan.detail!.prizes;
  const gives = useMemo(() => new Set(steps.filter((s) => s.gives).map((s) => s.id)), [steps]);
  const rows = useMemo(() => {
    const by = new Map<string, { name: string; sponsor: string | null; type: string | null; promised: number; given: number }>();
    for (const l of lines) {
      const given = done.filter((d) => d.line_id === l.id && gives.has(d.step_id)).reduce((n, d) => Math.max(n, d.done), 0);
      const r = by.get(l.prize_id) ?? { name: l.prize.name, sponsor: l.prize.sponsor, type: l.prize.type, promised: 0, given: 0 };
      r.promised += l.quantity; r.given += Math.min(given, l.quantity);
      by.set(l.prize_id, r);
    }
    return [...by.values()].sort((a, b) => (a.sponsor ?? '').localeCompare(b.sponsor ?? '') || a.name.localeCompare(b.name));
  }, [lines, done, gives]);
  if (rows.length === 0) return null;
  const left = rows.reduce((n, r) => n + (r.promised - r.given), 0);
  return (
    <details className={styles.wrapUp} open>
      <summary>Wrap-Up <span className={styles.dim}>{rows.reduce((n, r) => n + r.given, 0)} given · {left} left over</span></summary>
      {plan.detail!.plan.manual_return !== false && <p className={styles.dim}>Left over prizes do not go back to stock by themselves. Put the ones you are keeping on the Keep For Future list in Allocation, then move them to inventory.</p>}
      <table className={styles.grid}>
        <thead><tr><th>Prize</th><th>Type</th><th>Sponsor</th><th>Promised</th><th>Given</th><th>Left over</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.name}-${r.sponsor}`}>
              <td><b>{r.name}</b></td><td>{r.type ?? ''}</td><td>{r.sponsor ?? 'Club'}</td><td>{r.promised}</td><td>{r.given}</td>
              <td>{r.promised - r.given > 0 ? <b className={r.sponsor ? styles.flagWarn : undefined}>{r.promised - r.given}{r.sponsor ? ' · take back' : ''}</b> : 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
