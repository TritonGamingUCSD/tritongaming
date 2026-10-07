'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, MapPin } from 'lucide-react';
import { googleCalendarUrl } from '@/lib/events/calendarLinks';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import styles from './EventsCalendar.module.css';

export interface CalEvent { id: string; slug: string; name: string; start_date: string; end_date: string; location: string }

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: PACIFIC_TZ });   // 2026-10-06
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// A month at a glance: events sit on their day (San Diego time), and the list under the grid has each one with Add to Calendar links.
export default function EventsCalendar({ events }: { events: CalEvent[] }) {
  const today = dayKey(new Date().toISOString());
  const first = useMemo(() => { const [y, m] = today.split('-').map(Number); return { y, m: m - 1 }; }, [today]);
  const [view, setView] = useState(first);
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of [...events].sort((a, b) => a.start_date.localeCompare(b.start_date))) m.set(dayKey(e.start_date), [...(m.get(dayKey(e.start_date)) ?? []), e]);
    return m;
  }, [events]);

  const monthStart = new Date(Date.UTC(view.y, view.m, 1));
  const lead = monthStart.getUTCDay();
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => (i < lead || i >= lead + days ? null : i - lead + 1));
  const key = (d: number) => `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const label = monthStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const monthEvents = [...byDay.entries()].filter(([k]) => k.startsWith(`${view.y}-${String(view.m + 1).padStart(2, '0')}-`)).flatMap(([, v]) => v);
  const go = (delta: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  return (
    <div className={styles.cal}>
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft size={18} aria-hidden="true" /></button>
        <h3 className={styles.month} aria-live="polite">{label}</h3>
        <button type="button" className={styles.navBtn} onClick={() => go(1)} aria-label="Next month"><ChevronRight size={18} aria-hidden="true" /></button>
        {(view.y !== first.y || view.m !== first.m) && <button type="button" className={styles.todayBtn} onClick={() => setView(first)}>Today</button>}
      </div>
      <table className={styles.grid} aria-label={label}>
        <thead>
          <tr>{WEEK.map((w) => <th key={w} scope="col" className={styles.dow}>{w}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, w) => (
            <tr key={w}>
              {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
                const evs = d ? byDay.get(key(d)) ?? [] : [];
                return (
                  <td key={i} className={`${styles.day} ${d === null ? styles.blank : ''} ${d && key(d) === today ? styles.today : ''}`}>
                    {d !== null && <span className={styles.num}>{d}</span>}
                    {evs.map((e) => <Link key={e.id} href={`/events/${e.slug}`} className={styles.chip} title={`${e.name} · ${timeOf(e.start_date)}`}>{e.name}</Link>)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.agenda}>
        <h4>{monthEvents.length ? `This month (${monthEvents.length})` : 'Nothing scheduled this month'}</h4>
        <ul>
          {monthEvents.map((e) => (
            <li key={e.id}>
              <div className={styles.when}><strong>{new Date(e.start_date).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>{timeOf(e.start_date)}</span></div>
              <div className={styles.what}>
                <Link href={`/events/${e.slug}`}>{e.name}</Link>
                {e.location && <span className={styles.where}><MapPin size={12} aria-hidden="true" /> {e.location}</span>}
              </div>
              <div className={styles.add}>
                <a href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} aria-hidden="true" /> Google Calendar</a>
                <a href={`/api/events/${e.id}/ics`} download><CalendarPlus size={13} aria-hidden="true" /> Other (.ics)</a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
