'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays, Ticket, MapPin, Repeat, CalendarPlus, Copy, Check, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import { formatEventTimeRange } from '@/lib/timezone';
import { useLiveParams } from '@/lib/usePortalParams';
import { confirmHold } from '@/lib/confirmHold';
import styles from './calendar.module.css';
import TimeGrid from './TimeGrid';
import { ItemPopup, StatusBadge, timeOf, type Item } from './calendarParts';

type View = 'month' | 'week' | 'day' | 'agenda';
type Kind = Item['kind'];

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const addDays = (k: string, n: number) => { const d = new Date(`${k}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const pacificToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const longDay = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const sundayOf = (k: string) => addDays(k, -new Date(`${k}T12:00:00Z`).getUTCDay());
const shortDay = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

export default function CalendarSectionContent() {
  const today = pacificToday();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [view, setView] = useState<View>('month');
  const [selected, setSelected] = useState<string>(today);
  // The week shown in the week view (its Sunday).
  const [weekStart, setWeekStart] = useState(() => sundayOf(today));
  const [items, setItems] = useState<Item[] | null>(null);
  // What to show: which kinds, and only the ones I have a stake in (a ticket, hosting, going). Remembered on this device.
  const [kinds, setKinds] = useState<Kind[]>(['event', 'meeting', 'internal']);
  const [onlyMine, setOnlyMine] = useState(false);
  const [popup, setPopup] = useState<{ item: Item; rect: DOMRect } | null>(null);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  useEffect(() => {
    try { const f = JSON.parse(localStorage.getItem('calendar-filters') ?? 'null'); if (f) { setKinds(f.kinds); setOnlyMine(!!f.onlyMine); } } catch { /* no saved filters */ }
    const t = setInterval(() => setNowIso(new Date().toISOString()), 60_000);
    return () => clearInterval(t);
  }, []);
  function setFilters(k: Kind[], m: boolean) {
    setKinds(k); setOnlyMine(m);
    try { localStorage.setItem('calendar-filters', JSON.stringify({ kinds: k, onlyMine: m })); } catch { /* private window */ }
  }
  const [error, setError] = useState('');
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const params = useLiveParams();
  const [subscribeOpen, setSubscribeOpen] = useState(params.get('subscribe') === '1');

  // The grid always shows six full weeks, so fetch exactly that span.
  const gridStart = useMemo(() => {
    const first = key(cursor.y, cursor.m, 1);
    return addDays(first, -new Date(`${first}T12:00:00Z`).getUTCDay());
  }, [cursor]);
  const gridEnd = addDays(gridStart, 41);
  // What to fetch: the six-week month grid, or just the one week.
  const rangeWeek = view === 'week' ? weekStart : sundayOf(selected);
  const from = view === 'week' || view === 'day' ? rangeWeek : gridStart;
  const to = view === 'week' || view === 'day' ? addDays(rangeWeek, 6) : gridEnd;

  useEffect(() => {
    let live = true;
    setItems(null); setError('');
    fetch(`/api/calendar?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => { if (!live) return; if (ok) setItems(j.items); else setError(j.error || 'Failed to load the calendar.'); })
      .catch(() => { if (live) setError('Couldn’t reach the server.'); });
    return () => { live = false; };
  }, [from, to]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items ?? []) {
      if (!kinds.includes(i.kind) || (onlyMine && !i.status && !i.mine)) continue;
      map.set(i.date, [...(map.get(i.date) ?? []), i]);
    }
    return map;
  }, [items, kinds, onlyMine]);

  function shift(n: number) {
    if (view === 'week') { setWeekStart((w) => addDays(w, 7 * n)); return; }
    if (view === 'day') { setSelected((d) => addDays(d, n)); return; }
    setCursor((c) => { const d = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  }
  function goToday() { setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); setSelected(today); setWeekStart(sundayOf(today)); }
  // Switching view keeps you on the same stretch of time: the week (or month) of the day you last picked.
  function changeView(v: View) {
    setPopup(null);
    if (v === 'week') setWeekStart(sundayOf(selected));
    if (v === 'month') setCursor({ y: Number(selected.slice(0, 4)), m: Number(selected.slice(5, 7)) - 1 });
    setView(v);
  }

  const monthTitle = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayTitle = longDay(selected);
  const title = view === 'day' ? dayTitle : view === 'week' ? `${shortDay(weekStart)} – ${shortDay(addDays(weekStart, 6))}, ${addDays(weekStart, 6).slice(0, 4)}` : monthTitle;
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const dayItems = byDay.get(selected) ?? [];
  const agendaDays = [...byDay.keys()].filter((d) => d >= (view === 'agenda' ? today : gridStart) && d.slice(0, 7) === key(cursor.y, cursor.m, 1).slice(0, 7)).sort();

  return (
    <div className={styles.page} data-wide={view !== 'agenda' ? '' : undefined} data-month={view !== 'agenda' ? '' : undefined}>
      <div className={styles.header}>
        <h1 className={styles.title}>Calendar</h1>
        <p className={styles.sub}>Events and the meetings you’re invited to, in one place.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label={view === 'week' ? 'Previous week' : view === 'day' ? 'Previous day' : 'Previous month'}><ChevronLeft size={16} aria-hidden="true" /></Button>
          <h2 className={styles.month}>{title}</h2>
          <Button variant="secondary" size="sm" onClick={() => shift(1)} aria-label={view === 'week' ? 'Next week' : view === 'day' ? 'Next day' : 'Next month'}><ChevronRight size={16} aria-hidden="true" /></Button>
          <Button variant="ghost" size="sm" onClick={goToday}>Today</Button>
        </div>
        <div className={styles.toolbarRight}>
          <Button variant="secondary" size="sm" onClick={() => setSubscribeOpen((v) => !v)} aria-expanded={subscribeOpen}><CalendarPlus size={15} strokeWidth={1.75} aria-hidden="true" /> Add to my calendar</Button>
          <SectionTabs<View> variant="segmented" label="View" value={view} onChange={changeView} tabs={[{ id: 'month', label: 'Month' }, { id: 'week', label: 'Week' }, { id: 'day', label: 'Day' }, { id: 'agenda', label: 'List' }]} />
        </div>
      </div>
      {subscribeOpen && <SubscribePanel />}

      <div className={styles.filters} role="group" aria-label="What to show">
        {([['event', 'Events', styles.dotEvent], ['meeting', 'Meetings', styles.dotMeeting], ['internal', 'Internal events', styles.dotInternal]] as const).map(([k, label, dot]) => {
          const on = kinds.includes(k);
          return <button key={k} type="button" className={`${styles.filterChip} ${on ? styles.filterOn : ''}`} aria-pressed={on} onClick={() => setFilters(on ? kinds.filter((x) => x !== k) : [...kinds, k], onlyMine)}><i className={dot} /> {label}</button>;
        })}
        <span className={styles.filterSep} aria-hidden="true" />
        <button type="button" className={`${styles.filterChip} ${onlyMine ? styles.filterOn : ''}`} aria-pressed={onlyMine} onClick={() => setFilters(kinds, !onlyMine)} title="Only things you have a ticket for, host, or are going to"><Ticket size={12} aria-hidden="true" /> Only mine</button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {view === 'month' && (
        <div className={styles.monthLayout}>
          <div
            className={styles.grid} role="grid" aria-label={title}
            onTouchStart={(e) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
            onTouchEnd={(e) => {
              const st = swipe.current; swipe.current = null; if (!st) return;
              const dx = e.changedTouches[0].clientX - st.x, dy = e.changedTouches[0].clientY - st.y;
              if (Math.abs(dx) > 60 && Math.abs(dy) < 45) shift(dx < 0 ? 1 : -1);
            }}
          >
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
        </div>
      )}

      {(view === 'week' || view === 'day') && (
        <div className={styles.onlyWide}>
          <TimeGrid
            days={view === 'day' ? [selected] : weekDays}
            byDay={byDay} today={today} nowIso={nowIso}
            dayName={(d) => ({ name: WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()], num: Number(d.slice(8)) })}
            onOpen={(item, rect) => setPopup({ item, rect })}
          />
          {items === null && !error && <p className={styles.muted}>Loading…</p>}
        </div>
      )}
      {view === 'week' && (
        <div className={`${styles.week} ${styles.onlyNarrow}`} role="grid" aria-label={title}>
          {weekDays.map((d) => {
            const list = byDay.get(d) ?? [];
            return (
              <section key={d} className={`${styles.weekDay} ${d === today ? styles.weekToday : ''}`} role="gridcell" aria-label={`${longDay(d)}${list.length ? `, ${list.length} item${list.length === 1 ? '' : 's'}` : ''}`}>
                <header className={styles.weekHead}>
                  <span className={styles.weekName}>{WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
                  <span className={styles.weekNum}>{Number(d.slice(8))}</span>
                  {d === today && <span className={styles.todayTag}>Today</span>}
                </header>
                {items === null && !error ? <p className={styles.muted}>Loading…</p> : list.length === 0 ? <p className={styles.weekEmpty}>Nothing</p> : (
                  <ul className={styles.weekList}>
                    {list.map((i) => (
                      <li key={i.key}>
                        <Link href={i.href} className={`${styles.weekItem} ${i.kind === 'event' ? styles.itemEvent : i.kind === 'internal' ? styles.itemInternal : styles.itemMeeting}`}>
                          <span className={styles.itemBar} aria-hidden="true" />
                          <span className={styles.weekItemMain}>
                            <span className={styles.weekTime}>{i.kind === 'event' ? timeOf(i.start) : `${timeOf(i.start)}${i.end ? ` – ${timeOf(i.end)}` : ''}`}</span>
                            <span className={styles.weekTitle}>{i.title}{i.repeats && <Repeat size={11} aria-label="Repeats weekly" />}<StatusBadge status={i.status} compact /></span>
                            {i.location && <span className={styles.weekLoc}><MapPin size={10} aria-hidden="true" /> {i.location}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <section className={`${styles.dayPanel} ${styles.onlyNarrow}`} aria-live="polite">
          <h3 className={styles.dayTitle}>{longDay(selected)}{selected === today && <span className={styles.todayTag}>Today</span>}</h3>
          {items === null && !error ? <p className={styles.muted}>Loading…</p> : (byDay.get(selected) ?? []).length === 0 ? <p className={styles.muted}>Nothing on this day.</p> : <ItemList items={byDay.get(selected) ?? []} />}
        </section>
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
      {popup && <ItemPopup item={popup.item} anchor={popup.rect} onClose={() => setPopup(null)} />}
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
                <StatusBadge status={i.status} />
              </span>
              <span className={styles.itemMeta}>
                {i.kind === 'event' ? formatEventTimeRange(i.start, i.end) : `${timeOf(i.start)}${i.end ? ` – ${timeOf(i.end)}` : ''}`}
                {i.dayLabel && <> · {i.dayLabel}</>}
                {i.location && <> · <MapPin size={11} aria-hidden="true" /> {i.location}</>}
              </span>
            </span>
            <span className={styles.kind}>{i.kind === 'event' ? 'Event' : i.kind === 'internal' ? 'Internal event' : 'Meeting'}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// A private link that keeps Google / Apple / Outlook Calendar in step with this calendar (events, your meetings and
// internal events). Calendar apps re-check it about once an hour.
function SubscribePanel() {
  const [links, setLinks] = useState<{ https: string; webcal: string; google: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const load = useCallback(async (reset: boolean) => {
    setError('');
    try {
      const r = await fetch('/api/calendar/token', { method: reset ? 'POST' : 'GET', cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setLinks(j); else setError(j.error || 'Failed to load.');
    } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(false); }, [load]);
  async function copy() {
    if (!links) return;
    try { await navigator.clipboard.writeText(links.https); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError('Copy didn’t work. Select the link and copy it by hand.'); }
  }
  async function reset() {
    if (!(await confirmHold({ title: 'Make a new calendar link?', message: 'The old link stops working. You’ll need to add the new one to your calendar app again.', confirmLabel: 'Hold to reset' }))) return;
    await load(true);
  }
  return (
    <section className={styles.subscribe} aria-label="Add to my calendar">
      <h3 className={styles.dayTitle}>Add to my calendar</h3>
      <p className={styles.muted}>Subscribe once and events, your meetings and your internal events show up in your own calendar app and stay up to date. Keep this link private: anyone who has it can see your calendar.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {!links ? <p className={styles.muted}>Loading…</p> : (
        <>
          <div className={styles.subRow}>
            <a className={styles.subBtn} href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar</a>
            <a className={styles.subBtn} href={links.webcal}>Apple / Outlook</a>
            <Button variant="secondary" size="sm" onClick={copy}>{copied ? <><Check size={14} aria-hidden="true" /> Copied</> : <><Copy size={14} aria-hidden="true" /> Copy link</>}</Button>
            <Button variant="ghost" size="sm" onClick={reset}><RefreshCw size={14} aria-hidden="true" /> New link</Button>
          </div>
          <input className={styles.subLink} readOnly value={links.https} onFocus={(e) => e.currentTarget.select()} aria-label="Your private calendar link" />
        </>
      )}
    </section>
  );
}
