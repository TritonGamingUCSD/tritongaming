'use client';

import { useState } from 'react';
import { HandHelping, Undo2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import { slotRange, type ShiftGrid } from '@/lib/shifts/shifts';
import styles from './shifts.module.css';

const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });

// Swap and cover: ask the team to take a shift you can't work, take one someone else asked about, and (exec) undo a cover that was taken.
export default function CoverPanel({ grid, onAct }: { grid: ShiftGrid; onAct: (body: Record<string, unknown>) => Promise<boolean> }) {
  const plan = grid.plan!;
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);   // "<station>|<slot>" whose note box is open
  const [note, setNote] = useState('');
  const stationName = (id: string) => grid.stations.find((s) => s.id === id)?.name ?? 'Station';
  const when = (slot: number) => { const r = slotRange(plan, slot); return `${time(r.start)} – ${time(r.end)}`; };
  const act = async (key: string, body: Record<string, unknown>) => { setBusy(key); const ok = await onAct(body); setBusy(null); return ok; };

  const open = grid.covers.filter((c) => c.status === 'open');
  const taken = grid.covers.filter((c) => c.status === 'taken');
  const mine = grid.signups.filter((s) => s.user_id === grid.me && slotRange(plan, s.slot_index).end.getTime() > Date.now())
    .filter((s) => !open.some((c) => c.requester_id === grid.me && c.station_id === s.station_id && c.slot_index === s.slot_index))
    .sort((a, b) => a.slot_index - b.slot_index);
  const canAsk = grid.canSignUp && mine.length > 0;
  if (!canAsk && open.length === 0 && !(grid.canManage && taken.length)) return null;

  return (
    <section className={styles.card} aria-labelledby="cover-h">
      <h3 id="cover-h" className={styles.coverH}><HandHelping size={15} aria-hidden="true" /> Swap and cover</h3>
      {open.length > 0 && (
        <ul className={styles.coverList}>
          {open.map((c) => {
            const own = c.requester_id === grid.me;
            return (
              <li key={c.id} className={styles.coverRow}>
                <span><strong>{stationName(c.station_id)}</strong>, {when(c.slot_index)} <span className={styles.muted}>· {own ? 'you asked for cover' : `${c.requester_name} needs cover`}{c.note ? ` · “${c.note}”` : ''}</span></span>
                {own || grid.canManage ? <Button size="sm" variant="secondary" loading={busy === c.id} onClick={() => act(c.id, { action: 'cancel', request_id: c.id })}>{own ? 'Withdraw' : 'Remove'}</Button> : null}
                {!own && grid.canSignUp && <Button size="sm" loading={busy === c.id} onClick={() => act(c.id, { action: 'take', request_id: c.id })}>I’ll take it</Button>}
              </li>
            );
          })}
        </ul>
      )}
      {grid.canManage && taken.length > 0 && (
        <ul className={styles.coverList} aria-label="Covers taken">
          {taken.map((c) => (
            <li key={c.id} className={styles.coverRow}>
              <span><strong>{stationName(c.station_id)}</strong>, {when(c.slot_index)} <span className={styles.muted}>· {c.taken_by_name} covers {c.requester_name}</span></span>
              <Button size="sm" variant="secondary" loading={busy === c.id} onClick={() => act(c.id, { action: 'undo', request_id: c.id })}><Undo2 size={13} aria-hidden="true" /> Undo</Button>
            </li>
          ))}
        </ul>
      )}
      {canAsk && (
        <details className={styles.coverAsk}>
          <summary>Can’t make one of your shifts?</summary>
          <ul className={styles.coverList}>
            {mine.map((s) => {
              const key = `${s.station_id}|${s.slot_index}`;
              return (
                <li key={key} className={styles.coverRow}>
                  <span><strong>{stationName(s.station_id)}</strong>, {when(s.slot_index)}</span>
                  {asking === key ? (
                    <span className={styles.coverNote}>
                      <input className={styles.coverInput} value={note} maxLength={200} placeholder="Note for the team (optional)" aria-label="Note for the team" onChange={(e) => setNote(e.target.value)} />
                      <Button size="sm" loading={busy === key} onClick={async () => { if (await act(key, { action: 'ask', station_id: s.station_id, slot_index: s.slot_index, note })) { setAsking(null); setNote(''); } }}>Ask the team</Button>
                      <Button size="sm" variant="secondary" onClick={() => setAsking(null)}>Cancel</Button>
                    </span>
                  ) : <Button size="sm" variant="secondary" onClick={() => { setAsking(key); setNote(''); }}>Ask for cover</Button>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
