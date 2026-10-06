'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarPlus, CalendarSync, Users, MapPin, Repeat, Copy, Check, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import { formatEventTimeRange } from '@/lib/timezone';
import { useLiveParams } from '@/lib/usePortalParams';
import { confirmHold } from '@/lib/confirmHold';
import styles from './calendar.module.css';
import TimeGrid from './TimeGrid';
import GoogleLinkPanel from './GoogleLinkPanel';
import { ItemPopup, ItemRow, StatusBadge, kindKey, timeOf, type Item } from './calendarParts';
import SectionHeader from '@/components/ui/SectionHeader';

type View = 'month' | 'week' | 'day' | 'list';
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
  const [kinds, setKinds] = useState<Kind[]>(['event', 'meeting', 'internal', 'google']);
  // My own linked Google Calendar (view only): its events come with the response, separate from the shared ones.
  const [google, setGoogle] = useState<Item[]>([]);
  const [googleLinked, setGoogleLinked] = useState(false);
  // null until the first answer. A student outside the TG team gets events only, with no filters and no Google sync.
  const [eventsOnly, setEventsOnly] = useState<boolean | null>(null);
  const linking = eventsOnly === false;
  const [googleError, setGoogleError] = useState<string | null>(null);
  // "All TG meetings": also show everyone else's meetings (not the private ones), as plain read-only entries.
  const [allMeetings, setAllMeetings] = useState(false);
  const [canAll, setCanAll] = useState(true);
  const [popup, setPopup] = useState<{ item: Item; rect: DOMRect } | null>(null);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  useEffect(() => {
    try { const f = JSON.parse(localStorage.getItem('calendar-filters') ?? 'null'); if (f) { setKinds([...new Set([...(f.kinds as Kind[]), ...(f.kinds.includes('google') || f.googleOff ? [] : ['google' as Kind])])]); setAllMeetings(!!f.allMeetings); } } catch { /* no saved filters */ }
    const t = setInterval(() => setNowIso(new Date().toISOString()), 60_000);
    return () => clearInterval(t);
  }, []);
  function setFilters(k: Kind[], all: boolean = allMeetings) {
    setKinds(k); setAllMeetings(all);
    try { localStorage.setItem('calendar-filters', JSON.stringify({ kinds: k, allMeetings: all, googleOff: !k.includes('google') })); } catch { /* private window */ }
  }
  const [error, setError] = useState('');
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const params = useLiveParams();
  // One "Sync" panel holds both directions: bring my Google Calendar in, and send this calendar out to my own calendar app.
  const [syncOpen, setSyncOpen] = useState(params.get('subscribe') === '1' || !!params.get('gcal'));
  // Coming back from Google's screen lands here with ?gcal=…: open the link panel so the result is seen.
  const gcalResult = params.get('gcal');
  const [reload, setReload] = useState(0);

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
    fetch(`/api/calendar?from=${from}&to=${to}${allMeetings && canAll ? '&scope=all' : ''}`, { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j, status }) => { if (!live) return; if (status === 403 && allMeetings) { setCanAll(false); return; } if (ok) { setEventsOnly(!!j.eventsOnly); setItems(j.items); setGoogle(j.google ?? []); setGoogleLinked(!!j.googleLinked); setGoogleError(j.googleError ?? null); } else setError(j.error || 'Failed to load the calendar.'); })
      .catch(() => { if (live) setError('Couldn’t reach the server.'); });
    return () => { live = false; };
  }, [from, to, reload, allMeetings, canAll]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of [...(items ?? []), ...google]) {
      if (eventsOnly !== true && !kinds.includes(i.kind)) continue;
      map.set(i.date, [...(map.get(i.date) ?? []), i]);
    }
    return map;
  }, [items, google, kinds, eventsOnly]);

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
  const agendaDays = [...byDay.keys()].filter((d) => d >= (view === 'list' ? today : gridStart) && d.slice(0, 7) === key(cursor.y, cursor.m, 1).slice(0, 7)).sort();

  const syncButton = (cls: 'phoneOnly' | 'wideOnly') => (
    <Button variant="secondary" size="sm" className={`${styles.syncBtn} ${styles[cls]}`} onClick={() => setSyncOpen((v) => !v)} aria-expanded={syncOpen} aria-label={linking ? 'Sync calendars' : 'Add to my calendar'}>
      {linking ? <CalendarSync size={15} strokeWidth={1.75} aria-hidden="true" /> : <CalendarPlus size={15} strokeWidth={1.75} aria-hidden="true" />} <span className={styles.syncText}>{linking ? 'Sync' : 'Add to my calendar'}</span>
      {(googleLinked || googleError) && <i className={`${styles.syncDot} ${googleError ? styles.syncDotWarn : ''}`} aria-hidden="true" />}
    </Button>
  );

  return (
    <div className={styles.page} data-wide={view !== 'list' ? '' : undefined} data-month={view !== 'list' ? '' : undefined}>
      <SectionHeader title="Calendar" flush sub={eventsOnly ? 'Upcoming Triton Gaming events.' : 'Events and the meetings you’re invited to, in one place.'} actions={syncButton('phoneOnly')} />

      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label={view === 'week' ? 'Previous week' : view === 'day' ? 'Previous day' : 'Previous month'}><ChevronLeft size={16} aria-hidden="true" /></Button>
          <h2 className={styles.month}>{title}</h2>
          <Button variant="secondary" size="sm" onClick={() => shift(1)} aria-label={view === 'week' ? 'Next week' : view === 'day' ? 'Next day' : 'Next month'}><ChevronRight size={16} aria-hidden="true" /></Button>
          <Button variant="ghost" size="sm" onClick={goToday}>Today</Button>
        </div>
        <div className={styles.viewSwitch}>
          <SectionTabs<View> variant="segmented" label="View" value={view} onChange={changeView} tabs={[{ id: 'month', label: 'Month' }, { id: 'week', label: 'Week' }, { id: 'day', label: 'Day' }, { id: 'list', label: 'List' }]} />
        </div>
        <div className={styles.toolbarRight}>
          {syncButton('wideOnly')}
        </div>
      </div>
      {syncOpen && (
        <div className={`${styles.syncGrid} ${linking ? '' : styles.syncSingle}`}>
          {linking && <GoogleLinkPanel result={gcalResult} onChanged={() => setReload((n) => n + 1)} />}
          <SubscribePanel />
        </div>
      )}
      {linking && googleError && !syncOpen && <Notice tone="warning">Your Google Calendar couldn’t be loaded just now, so its events aren’t shown. Open Sync to link it again.</Notice>}

      {eventsOnly === false && <div className={styles.filters} role="group" aria-label="What to show">
        {([['event', 'Events', styles.dotEvent], ['meeting', 'Meetings', styles.dotMeeting], ['internal', 'Internal events', styles.dotInternal], ...(googleLinked ? [['google', 'My Google Calendar', styles.dotGoogle]] : [])] as [Kind, string, string][]).map(([k, label, dot]) => {
          const on = kinds.includes(k);
          return <button key={k} type="button" className={`${styles.filterChip} ${on ? styles.filterOn : ''}`} aria-pressed={on} onClick={() => setFilters(on ? kinds.filter((x) => x !== k) : [...kinds, k])}><i className={dot} /> {label}</button>;
        })}
        {canAll && <span className={styles.filterSep} aria-hidden="true" />}
        {canAll && <button type="button" className={`${styles.filterChip} ${allMeetings ? styles.filterOn : ''}`} aria-pressed={allMeetings} onClick={() => setFilters(kinds, !allMeetings)} title="Also show every other meeting on the team, except the ones a host marked private"><Users size={12} aria-hidden="true" /> All TG meetings</button>}
      </div>}

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
                    {list.map((i) => <span key={i.key} className={`${styles.chip} ${styles['chip' + kindKey(i.kind)]} ${i.others ? styles.chipOthers : ''}`}>{i.title}</span>)}
                  </span>
                  <span className={styles.dots} aria-hidden="true">
                    {list.map((i) => <i key={i.key} className={`${styles['dot' + kindKey(i.kind)]} ${i.others ? styles.chipOthers : ''}`} />)}
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
                        <ItemRow item={i} className={`${styles.weekItem} ${styles['item' + kindKey(i.kind)]}`}>
                          <span className={styles.itemBar} aria-hidden="true" />
                          <span className={styles.weekItemMain}>
                            <span className={styles.weekTime}>{i.allDay ? 'All day' : i.kind === 'event' ? timeOf(i.start) : `${timeOf(i.start)}${i.end ? ` – ${timeOf(i.end)}` : ''}`}</span>
                            <span className={styles.weekTitle}>{i.title}{i.repeats && <Repeat size={11} aria-label="Repeats weekly" />}<StatusBadge status={i.status} compact /></span>
                            {i.location && <span className={styles.weekLoc}><MapPin size={10} aria-hidden="true" /> {i.location}</span>}
                          </span>
                        </ItemRow>
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

      {view === 'list' && (
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
          <ItemRow item={i} className={`${styles.item} ${styles['item' + kindKey(i.kind)]}`}>
            <span className={styles.itemBar} aria-hidden="true" />
            <span className={styles.itemMain}>
              <span className={styles.itemTitle}>
                {i.title}
                {i.repeats && <Repeat size={12} aria-label="Repeats weekly" />}
                <StatusBadge status={i.status} />
              </span>
              <span className={styles.itemMeta}>
                {i.allDay ? 'All day' : i.kind === 'event' ? formatEventTimeRange(i.start, i.end) : `${timeOf(i.start)}${i.end ? ` – ${timeOf(i.end)}` : ''}`}
                {i.dayLabel && <> · {i.dayLabel}</>}
                {i.location && <> · <MapPin size={11} aria-hidden="true" /> {i.location}</>}
              </span>
            </span>
            <span className={styles.kind}>{i.kind === 'event' ? 'Event' : i.kind === 'internal' ? 'Internal event' : i.kind === 'google' ? 'Google' : 'Meeting'}</span>
          </ItemRow>
        </li>
      ))}
    </ul>
  );
}

// Private links that keep Google / Apple / Outlook Calendar in step with this calendar. "My TG Calendar" is what this page shows for you
// (events, your meetings and your internal events); "TG Calendar" is the unified one: all events plus every public meeting on the team.
// Calendar apps re-check them about once an hour.
type FeedLink = { https: string; webcal: string; google: string };
function SubscribePanel() {
  const [links, setLinks] = useState<(FeedLink & { tg: FeedLink | null }) | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'mine' | 'tg' | null>(null);
  const load = useCallback(async (reset: boolean) => {
    setError('');
    try {
      const r = await fetch('/api/calendar/token', { method: reset ? 'POST' : 'GET', cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setLinks(j); else setError(j.error || 'Failed to load.');
    } catch { setError('Couldn’t reach the server.'); }
  }, []);
  useEffect(() => { void load(false); }, [load]);
  async function copy(which: 'mine' | 'tg') {
    const link = which === 'tg' ? links?.tg : links;
    if (!link) return;
    try { await navigator.clipboard.writeText(link.https); setCopied(which); setTimeout(() => setCopied(null), 2000); } catch { setError('Copy didn’t work. Select the link and copy it by hand.'); }
  }
  async function reset() {
    if (!(await confirmHold({ title: 'Make new calendar links?', message: 'Both of your calendar links stop working. You’ll need to add the new ones to your calendar app again.', confirmLabel: 'Hold to reset' }))) return;
    await load(true);
  }
  const block = (which: 'mine' | 'tg', link: FeedLink, title: string, blurb: string) => (
    <div className={styles.subBlock}>
      <h4 className={styles.subTitle}>{title}</h4>
      <p className={styles.muted}>{blurb}</p>
      <div className={styles.subRow}>
        <a className={styles.subBtn} href={link.google} target="_blank" rel="noopener noreferrer">Google Calendar</a>
        <a className={styles.subBtn} href={link.webcal}>Apple / Outlook</a>
        <Button variant="secondary" size="sm" onClick={() => copy(which)}>{copied === which ? <><Check size={14} aria-hidden="true" /> Copied</> : <><Copy size={14} aria-hidden="true" /> Copy link</>}</Button>
      </div>
      <input className={styles.subLink} readOnly value={link.https} onFocus={(e) => e.currentTarget.select()} aria-label={`${title} link`} />
    </div>
  );
  return (
    <section className={styles.subscribe} aria-label="Add to my calendar">
      <h3 className={styles.dayTitle}>Add Triton Gaming to my own calendar app</h3>
      <p className={styles.muted}>Subscribe once and it stays up to date in your calendar app. Keep these links private: anyone who has one can see what is on that calendar.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {!links ? <p className={styles.muted}>Loading…</p> : (
        <>
          {links.tg && block('tg', links.tg, 'TG Calendar', 'Everything at Triton Gaming: all events and every public meeting on the team (private meetings are left out).')}
          {block('mine', links, links.tg ? 'My TG Calendar' : 'TG Events Calendar', links.tg ? 'Just yours: events, your meetings and your internal events, including the ones you host or are going to.' : 'All upcoming Triton Gaming events.')}
          <div className={styles.subRow}>
            <Button variant="ghost" size="sm" onClick={reset}><RefreshCw size={14} aria-hidden="true" /> New links</Button>
          </div>
        </>
      )}
    </section>
  );
}
