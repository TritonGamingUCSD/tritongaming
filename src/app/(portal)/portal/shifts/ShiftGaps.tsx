'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PACIFIC_TZ } from '@/lib/timezone';
import { awayDuring, cellKey, groupByArea, neededFor, slotCount, slotRange, type ShiftGrid } from '@/lib/shifts';
import styles from './shifts.module.css';

const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });

interface Gap { stationId: string; station: string; area: string | null; slot: number; open: number; needed: number }
interface Candidate { id: string; name: string; owes: number; count: number }

/** Every spot still open, by time slot, with the people who could take it: free then (no other station, not away), the ones who still owe shifts first. */
export function gapsOf(grid: ShiftGrid): { slot: number; gaps: Gap[] }[] {
  const plan = grid.plan!;
  const here = new Map<string, number>();
  for (const s of grid.signups) here.set(cellKey(s.station_id, s.slot_index), (here.get(cellKey(s.station_id, s.slot_index)) ?? 0) + 1);
  const out: { slot: number; gaps: Gap[] }[] = [];
  for (let i = 0; i < slotCount(plan); i++) {
    const gaps: Gap[] = [];
    for (const group of groupByArea(grid.stations)) {
      for (const st of group.stations) {
        const needed = neededFor(grid, st.id, i);
        const open = needed - (here.get(cellKey(st.id, i)) ?? 0);
        if (open > 0) gaps.push({ stationId: st.id, station: st.name, area: group.area, slot: i, open, needed });
      }
    }
    if (gaps.length) out.push({ slot: i, gaps });
  }
  return out;
}

export default function GapsPanel({ grid, onPlace }: { grid: ShiftGrid; onPlace: (stationId: string, slot: number, who: string) => Promise<void> }) {
  const plan = grid.plan!;
  const [busy, setBusy] = useState<string | null>(null);
  const bySlot = useMemo(() => gapsOf(grid), [grid]);
  const total = bySlot.reduce((n, s) => n + s.gaps.reduce((m, g) => m + g.open, 0), 0);
  const needAll = useMemo(() => { let n = 0; for (let i = 0; i < slotCount(plan); i++) for (const st of grid.stations) n += neededFor(grid, st.id, i); return n; }, [grid, plan]);
  const owes = new Map((grid.requirement?.people ?? []).map((p) => [p.id, Math.max(0, p.need - p.count)]));
  const counts = new Map<string, number>();
  for (const s of grid.signups) counts.set(s.user_id, (counts.get(s.user_id) ?? 0) + 1);

  function candidates(slot: number): Candidate[] {
    const r = slotRange(plan, slot);
    const busyNow = new Set(grid.signups.filter((s) => s.slot_index === slot).map((s) => s.user_id));
    return grid.roster
      .filter((p) => !busyNow.has(p.id) && !awayDuring(grid.absences.filter((a) => a.user_id === p.id), r))
      .map((p) => ({ id: p.id, name: p.name, owes: owes.get(p.id) ?? 0, count: counts.get(p.id) ?? 0 }))
      .sort((a, b) => b.owes - a.owes || a.count - b.count || a.name.localeCompare(b.name));
  }

  if (total === 0) return <div className={styles.card}><p className={styles.muted}>Every shift is covered. Nothing is open.</p></div>;
  return (
    <div className={styles.gaps}>
      <div className={styles.card}>
        <h3 className={styles.h}>How this works</h3>
        <p className={styles.muted}>This lists every spot that still needs a person, grouped by time. Under each station are the people who could take it: they are not already working another station at that time, and not marked away. People who still owe shifts come first and show <strong>owes 1</strong> (how many more they need). Press a name to put them on that shift; nothing changes until you press.</p>
      </div>
      <p className={styles.summary}>{total} open spot{total === 1 ? '' : 's'} across {bySlot.length} time slot{bySlot.length === 1 ? '' : 's'} · {Math.round(((needAll - total) / Math.max(1, needAll)) * 100)}% covered</p>
      {bySlot.map(({ slot, gaps }) => {
        const r = slotRange(plan, slot);
        const pool = candidates(slot);
        return (
          <section key={slot} className={styles.card} aria-label={`${time(r.start)} to ${time(r.end)}`}>
            <h3 className={styles.h}>{time(r.start)} – {time(r.end)}</h3>
            <ul className={styles.gapList}>
              {gaps.map((g) => (
                <li key={g.stationId}>
                  <div className={styles.gapHead}><strong>{g.station}</strong>{g.area && <span className={styles.awayTag}>{g.area}</span>}<span className={styles.short}>{g.open} more needed</span></div>
                  {pool.length === 0 ? <span className={styles.muted}>Nobody is free then.</span> : (
                    <div className={styles.gapPick}>
                      {pool.slice(0, 5).map((p) => {
                        const key = `${g.stationId}|${slot}|${p.id}`;
                        return (
                          <Button key={p.id} size="sm" variant="secondary" disabled={busy === key} onClick={async () => { setBusy(key); await onPlace(g.stationId, slot, p.id); setBusy(null); }}>
                            <Plus size={13} aria-hidden="true" /> {p.name}{p.owes > 0 ? <span className={styles.owes}> owes {p.owes}</span> : null}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
