'use client';

import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { tagKey } from '@/lib/logistics/devices';
import { rowKind, stepAppliesTo, type StepDef } from '@/lib/logistics/plans';
import type { Row } from './planRows';
import type { Station } from './usePlans';
import type { Device } from '@/lib/logistics/devices';
import styles from './logistics.module.css';

// One search for any device (inventory, sponsor or officer loaner): type part of an ID and it says what the device is for in this event: which row and team it goes to, where to get it, and what
// step is next. Choosing a device taken for this event jumps to its line.
export default function DeviceFinder({ rows, devices, stations, steps, doneSet, onGo }: {
  rows: Row[]; devices: Device[]; stations: Station[]; steps: StepDef[]; doneSet: Set<string>; onGo: (row: Row) => void;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const q = tagKey(text);
  const hits = useMemo(() => {
    if (!q) return [];
    const inPlan = rows.filter((r) => r.kind !== 'slot' && r.tag && tagKey(r.tag).includes(q));
    const seen = new Set(inPlan.map((r) => r.id));
    const elsewhere = devices.filter((d) => d.tag && !seen.has(d.id) && tagKey(d.tag).includes(q)).slice(0, 4);
    return [...inPlan.slice(0, 6).map((r) => ({ row: r as Row | null, dev: null as Device | null })), ...elsewhere.map((d) => ({ row: null, dev: d }))].slice(0, 6);
  }, [q, rows, devices]);
  const stationOf = new Map(stations.map((s) => [s.id, s]));

  function line(r: Row) {
    const st = r.stationId ? stationOf.get(r.stationId) : null;
    const mine = steps.filter((s) => stepAppliesTo(s, rowKind(r)));
    const done = mine.filter((s) => doneSet.has(`${r.id}:${s.id}`)).length;
    const next = mine.find((s) => !doneSet.has(`${r.id}:${s.id}`));
    return { st, done, total: mine.length, next };
  }
  return (
    <div ref={box} className={styles.finder} onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <label className={styles.finderBox}>
        <Search size={14} aria-hidden="true" />
        <input value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Find a device ID" aria-label="Find a device by ID" autoComplete="off" autoCapitalize="characters" />
      </label>
      {open && q && (
        <ul className={styles.finderList} role="listbox">
          {hits.length === 0 && <li className={styles.finderEmpty}>No device with that ID.</li>}
          {hits.map(({ row, dev }) => {
            if (row) {
              const { st, done, total, next } = line(row);
              return (
                <li key={row.id}>
                  <button type="button" className={styles.finderHit} onClick={() => { onGo(row); setOpen(false); }}>
                    <b>{row.tag}</b> <span className={styles.dim}>{row.type}{row.kind === 'sponsor' ? ' · sponsor loaner' : row.kind === 'officer' ? ' · officer loaner' : ''}</span>
                    <span>{st ? <>Goes to <b>{st.name}</b>{st.room ? ` · ${st.room}` : ''}{st.contact ? ` · ${st.contact}` : ''}</> : <span className={styles.warnText}>In the event, not given to a team</span>}</span>
                    <span className={styles.dim}>Get it: {row.located ? row.where : 'not located yet'}</span>
                    <span className={styles.dim}>{total ? (next ? `Next: ${next.name} (${done}/${total} done)` : 'All steps done') : ''}</span>
                  </button>
                </li>
              );
            }
            const d = dev!;
            return (
              <li key={d.id}>
                <div className={styles.finderHit}>
                  <b>{d.tag}</b> <span className={styles.dim}>{d.type}</span>
                  <span className={styles.dim}>Not in this event. Stored at {[d.shelf, d.tier].filter(Boolean).join(' · ') || 'no place yet'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
