'use client';

import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { tagKey } from '@/lib/logistics/devices';
import { rowKind, stepAppliesTo, type StepDef } from '@/lib/logistics/plans';
import type { Row } from './planRows';
import type { Station } from './usePlans';
import type { Device } from '@/lib/logistics/devices';
import type { PrizeRow } from './usePrizes';
import type { PlanPrizesData } from './usePlans';
import styles from './logistics.module.css';

// One search for any device (inventory, sponsor or officer loaner) and any prize: type part of an ID, a name, a type or a sponsor and it says what the device is for in this event: which row and team it goes to, where to get it, and what
// step is next. Choosing a device taken for this event jumps to its line.
export default function DeviceFinder({ rows, devices, stations, steps, doneSet, onGo, prizes, planPrizes, sponsorOf, onGoPrize }: {
  rows: Row[]; devices: Device[]; stations: Station[]; steps: StepDef[]; doneSet: Set<string>; onGo: (row: Row) => void;
  prizes: PrizeRow[] | null; planPrizes: PlanPrizesData; sponsorOf: (id: string | null) => string | null; onGoPrize: () => void;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const q = tagKey(text);
  const needle = text.trim().toLowerCase();
  const words = (...v: (string | null | undefined)[]) => v.some((x) => x?.toLowerCase().includes(needle));
  const hits = useMemo(() => {
    if (!q && !needle) return [];
    const matchRow = (r: Row) => r.kind !== 'slot' && ((r.tag && tagKey(r.tag).includes(q)) || words(r.tag, r.name, r.type));
    const inPlan = rows.filter(matchRow);
    const seen = new Set(inPlan.map((r) => r.id));
    const elsewhere = devices.filter((d) => !seen.has(d.id) && ((d.tag && tagKey(d.tag).includes(q)) || words(d.tag, d.name, d.type))).slice(0, 5);
    return [...inPlan.slice(0, 8).map((r) => ({ row: r as Row | null, dev: null as Device | null })), ...elsewhere.map((d) => ({ row: null, dev: d }))].slice(0, 8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, needle, rows, devices]);
  const prizeHits = useMemo(() => {
    if (!needle) return [];
    const pools = new Map(planPrizes.pools.map((p) => [p.id, p.name]));
    const mine = planPrizes.lines.filter((l) => words(l.prize.name, l.prize.type, l.prize.sponsor, l.prize.size)).map((l) => ({ key: l.id, name: l.prize.name, detail: [l.prize.type, l.prize.sponsor, l.prize.size].filter(Boolean).join(' · '), where: `In this event: ${pools.get(l.pool_id) ?? 'a pool'} (${l.quantity})` }));
    const inPlanIds = new Set(planPrizes.lines.map((l) => l.prize_id));
    const rest = (prizes ?? []).filter((p) => !inPlanIds.has(p.id) && words(p.name, p.type, sponsorOf(p.sponsor_id), p.size)).slice(0, 5).map((p) => ({ key: p.id, name: p.name, detail: [p.type, sponsorOf(p.sponsor_id), p.size].filter(Boolean).join(' · '), where: `Not in this event. ${p.left} left in stock` }));
    return [...mine.slice(0, 6), ...rest].slice(0, 8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle, planPrizes, prizes]);
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
        <input value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search devices and prizes" aria-label="Search devices and prizes" autoComplete="off" autoCapitalize="characters" />
      </label>
      {open && needle && (
        <ul className={styles.finderList} role="listbox">
          {hits.length === 0 && prizeHits.length === 0 && <li className={styles.finderEmpty}>Nothing matches that.</li>}
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
          {prizeHits.map((h) => (
            <li key={h.key}>
              <button type="button" className={styles.finderHit} onClick={() => { onGoPrize(); setOpen(false); }}>
                <b>{h.name}</b> <span className={styles.dim}>{h.detail || 'prize'}</span>
                <span className={styles.dim}>{h.where}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
