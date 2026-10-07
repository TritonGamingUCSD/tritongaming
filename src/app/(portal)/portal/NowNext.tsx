'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Check, MapPin } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import type { MyShift } from '@/lib/shifts/myShifts';
import styles from './dashboardHome.module.css';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' });
const ARRIVE_EARLY_MS = 30 * 60_000;   // keep in step with api/shifts/[eventId]/arrive

function rel(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// "Now and next" for the dashboard: the shift you are on right now (with I'm here and its guide), then the ones after it.
export default function NowNext({ shifts }: { shifts: MyShift[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [arrived, setArrived] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  useVisiblePoll(() => setNow(Date.now()), 30_000);   // keeps the countdowns honest without any request
  const live = shifts.filter((s) => new Date(s.end).getTime() > now);
  const key = (s: MyShift) => `${s.eventId}|${s.stationId}|${s.slot}`;
  const [first, ...later] = live;
  // Close to the shift: bring in its checklist and the last note, so the card is everything you need on the day.
  // (Hooks stay above the early return below, so the order never changes between renders.)
  const [prep, setPrep] = useState<{ items: { id: string; label: string; done: boolean }[]; note: string | null } | null>(null);
  const soon = !!first && now >= new Date(first.start).getTime() - ARRIVE_EARLY_MS;
  const eventId = first?.eventId, stationId = first?.stationId;
  useEffect(() => {
    if (!soon || !eventId || !stationId) return;
    let alive = true;
    fetch(`/api/shifts/${eventId}`).then((r) => r.json()).then((j) => {
      if (!alive || !j.grid) return;
      setPrep({ items: (j.grid.checklists?.[stationId] ?? []).map((i: { id: string; label: string; done_at: string | null }) => ({ id: i.id, label: i.label, done: !!i.done_at })), note: j.grid.handoffs?.[stationId]?.[0]?.body ?? null });
    }).catch(() => {});
    return () => { alive = false; };
  }, [soon, eventId, stationId]);
  if (!first) return null;
  const on = new Date(first.start).getTime() <= now;
  const canTap = soon;
  const here = first.arrived || arrived[key(first)];
  async function toggle(id: string, done: boolean) {
    setPrep((p) => p && { ...p, items: p.items.map((i) => (i.id === id ? { ...i, done } : i)) });
    const r = await fetch(`/api/shifts/${first.eventId}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: id, done }) });
    if (!r.ok) { setPrep((p) => p && { ...p, items: p.items.map((i) => (i.id === id ? { ...i, done: !done } : i)) }); setError(((await r.json().catch(() => ({}))) as { error?: string }).error || 'Couldn’t save that.'); }
  }
  async function tap() {
    setBusy(key(first)); setError('');
    const r = await fetch(`/api/shifts/${first.eventId}/arrive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ station_id: first.stationId, slot_index: first.slot }) });
    if (r.ok) setArrived((a) => ({ ...a, [key(first)]: true })); else setError(((await r.json().catch(() => ({}))) as { error?: string }).error || 'Couldn’t check you in.');
    setBusy(null);
  }
  return (
    <article className={`${styles.nowNext} ${first.category === 'team' ? styles.nnTeam : styles.nnGeneral}`} aria-label="Your shifts">
      <span className={styles.sticker}>{on ? 'On shift now' : 'Next shift'}</span>
      <h2 className={styles.eventTitle}>{first.stationName}</h2>
      <p className={styles.when}>{first.eventTitle} · {day(first.start)} · {time(first.start)} to {time(first.end)}</p>
      <p className={styles.nnCount} role="status">{on ? `Ends in ${rel(new Date(first.end).getTime() - now)}` : `Starts in ${rel(new Date(first.start).getTime() - now)}`}</p>
      {first.location && <p className={styles.where}><MapPin size={14} aria-hidden="true" /> {first.location}</p>}
      <div className={styles.actions}>
        {here ? <span className={styles.nnHere}><Check size={16} aria-hidden="true" /> Checked in</span>
          : <button type="button" className={styles.primary} disabled={!canTap || busy === key(first)} onClick={() => void tap()} title={canTap ? undefined : 'Opens 30 minutes before the shift'}><Check size={16} aria-hidden="true" /> I’m here</button>}
        <Link href={`/portal/shifts?event=${first.eventId}&guide=${first.stationId}`} className={styles.secondary}><BookOpen size={16} aria-hidden="true" /> Open guide</Link>
      </div>
      {error && <p className={styles.nnError} role="alert">{error}</p>}
      {prep?.note && <p className={styles.nnNote}><strong>Note from the last shift:</strong> {prep.note}</p>}
      {prep && prep.items.length > 0 && (
        <ul className={styles.nnChecks} aria-label="Checklist">
          {prep.items.map((i) => <li key={i.id}><label><input type="checkbox" checked={i.done} onChange={(e) => void toggle(i.id, e.target.checked)} /> <span className={i.done ? styles.nnDone : undefined}>{i.label}</span></label></li>)}
        </ul>
      )}
      <p className={styles.nnCover}><Link href={`/portal/shifts?event=${first.eventId}`}>Can’t make it? Ask for cover</Link></p>
      {later.length > 0 && (
        <ul className={styles.nnLater} aria-label="Later">
          {later.slice(0, 3).map((s) => <li key={key(s)}><strong>{s.stationName}</strong> <span>{day(s.start)} · {time(s.start)} to {time(s.end)}{s.location ? ` · ${s.location}` : ''}</span></li>)}
        </ul>
      )}
    </article>
  );
}
