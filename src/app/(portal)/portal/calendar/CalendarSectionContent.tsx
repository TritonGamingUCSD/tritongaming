'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays, Ticket, MapPin, Repeat } from 'lucide-react';
import Button from '@/components/ui/Button';
import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import { formatEventTimeRange } from '@/lib/timezone';
import styles from './calendar.module.css';

interface Item {
  key: string; kind: 'event' | 'meeting' | 'internal'; date: string; title: string; start: string; end: string | null;
  location: string | null; href: string; mine: boolean; dayLabel: string | null; repeats?: boolean;
}
type View = 'month' | 'agenda';

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const addDays = (k: string, n: number) => { const d = new Date(`${k}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const pacificToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const longDay = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarSectionContent() {
  const today = pacificToday();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [view, setView] = useState<View>('month');
  const [selected, setSelected] = useState<string>(today);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');

  // The grid always shows six full weeks, so fetch exactly that span.
  const gridStart = useMemo(() => {
    const first = key(cursor.y, cursor.m, 1);
    return addDays(first, -new Date(`${first}T12:00:00Z`).getUTCDay());
  }, [cursor]);
  const gridEnd = addDays(gridStart, 41);

  useEffect(() => {
    let live = true;
    setItems(null); setError('');
    fetch(`/api/calendar?from=${gridStart}&to=${gridEnd}`, { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => { if (!live) return; if (ok) setItems(j.items); else setError(j.error || 'Failed to load the calendar.'); })
      .catch(() => { if (live) setError('Couldn’t reach the server.'); });
    return () => { live = false; };
  }, [gridStart, gridEnd]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items ?? []) map.set(i.date, [...(map.get(i.date) ?? []), i]);
    return map;
  }, [items]);

  function shift(n: number) {
    setCursor((c) => { const d = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  }
  function goToday() { setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); setSelected(today); }

  const title = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const dayItems = byDay.get(selected) ?? [];
  const agendaDays = [...byDay.keys()].filter((d) => d >= (view === 'agenda' ? today : gridStart) && d.slice(0, 7) === key(cursor.y, cursor.m, 1).slice(0, 7)).sort();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Calendar</h1>
        <p className={styles.sub}>Events and the meetings you’re invited to, in one place.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} aria-hidden="true" /></Button>
          <h2 className={styles.month}>{title}</h2>
          <Button variant="secondary" size="sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} aria-hidden="true" /></Button>
          <Button variant="ghost" size="sm" onClick={goToday}>Today</Button>
        </div>
        <SectionTabs<View> variant="segmented" label="View" value={view} onChange={setView} tabs={[{ id: 'month', label: 'Month' }, { id: 'agenda', label: 'List' }]} />
      </div>

      <div className={styles.legend}>
        <span><i className={styles.dotEvent} /> Event</span>
        <span><i className={styles.dotMeeting} /> Meeting</span>
        <span><i className={styles.dotInternal} /> Internal event</span>
        <span><Ticket size={12} aria-hidden="true" /> You have a ticket</span>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {view === 'month' && (
        <>
          <div className={styles.grid} role="grid" aria-label={title}>
            {WEEKDAYS.map((w) => <div key={w} className={styles.weekday} role="columnheader">{w}</div>)}
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === key(cursor.y, cursor.m, 1).slice(0, 7);
              return (
                <button
                  key={d} type="button" role="gridcell"
                  className={`${styles.cell} ${inMonth ? '' : styles.outside} ${d === today ? styles.today : ''} ${d === selected ? styles.selected : ''}`}
                  onClick={() => setSelected(d)}
                  aria-label={`${longDay(d)}${list.length ? `, ${list.length} item${list.length === 1 ? '' : 's'}` : ''}`}
                  aria-pressed={d === selected}
                >
                  <span className={styles.num}>{Number(d.slice(8))}</span>
                  <span className={styles.chips}>
                    {list.slice(0, 3).map((i) => <span key={i.key} className={`${styles.chip} ${i.kind === 'event' ? styles.chipEvent : i.kind === 'internal' ? styles.chipInternal : styles.chipMeeting}`}>{i.title}</span>)}
                    {list.length > 3 && <span className={styles.more}>+{list.length - 3} more</span>}
                  </span>
                  <span className={styles.dots} aria-hidden="true">
                    {list.slice(0, 4).map((i) => <i key={i.key} className={i.kind === 'event' ? styles.dotEvent : i.kind === 'internal' ? styles.dotInternal : styles.dotMeeting} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <section className={styles.dayPanel} aria-live="polite">
            <h3 className={styles.dayTitle}>{longDay(selected)}{selected === today && <span className={styles.todayTag}>Today</span>}</h3>
            {items === null && !error ? <p className={styles.muted}>Loading…</p> : dayItems.length === 0 ? <p className={styles.muted}>Nothing on this day.</p> : <ItemList items={dayItems} />}
          </section>
        </>
      )}

      {view === 'agenda' && (
        items === null && !error ? <p className={styles.muted}>Loading…</p> : agendaDays.length === 0 ? (
          <div className={styles.empty}><CalendarDays size={28} strokeWidth={1.5} aria-hidden="true" /><p>Nothing coming up this month.</p></div>
        ) : (
          <div className={styles.agenda}>
            {agendaDays.map((d) => (
              <section key={d}>
                <h3 className={styles.dayTitle}>{longDay(d)}{d === today && <span className={styles.todayTag}>Today</span>}</h3>
                <ItemList items={byDay.get(d) ?? []} />
              </section>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ItemList({ items }: { items: Item[] }) {
  return (
    <ul className={styles.list}>
      {items.map((i) => (
        <li key={i.key}>
          <Link href={i.href} className={`${styles.item} ${i.kind === 'event' ? styles.itemEvent : i.kind === 'internal' ? styles.itemInternal : styles.itemMeeting}`}>
            <span className={styles.itemBar} aria-hidden="true" />
            <span className={styles.itemMain}>
              <span className={styles.itemTitle}>
                {i.title}
                {i.repeats && <Repeat size={12} aria-label="Repeats weekly" />}
                {i.mine && i.kind === 'event' && <Ticket size={13} aria-label="You have a ticket" className={styles.ticket} />}
              </span>
              <span className={styles.itemMeta}>
                {i.kind === 'event' ? formatEventTimeRange(i.start, i.end) : `${timeOf(i.start)}${i.end ? ` – ${timeOf(i.end)}` : ''}`}
                {i.dayLabel && <> · {i.dayLabel}</>}
                {i.location && <> · <MapPin size={11} aria-hidden="true" /> {i.location}</>}
              </span>
            </span>
            <span className={styles.kind}>{i.kind === 'event' ? 'Event' : i.kind === 'internal' ? 'Internal event' : i.mine ? 'Hosting' : 'Meeting'}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
