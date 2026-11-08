'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarPlus, ChevronLeft, ChevronRight, Download, ExternalLink, MapPin } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { addDaysKey, daysBetweenKeys, formatPacificDate, formatPacificTime, pacificToday } from '@/lib/core/timezone';
import { CAL_VIEWS, daysIn, groupByDay, startOfWeek, stepDate, viewRange, type CalView } from '@/lib/calendar/grid';
import { buildIcs, googleLink, icsFileName, outlookLink } from '@/lib/calendar/ics';
import { CAL_KINDS, KIND_INFO, type CalItem, type CalKind } from '@/lib/calendar/types';
import type { CalendarData, CalTerm } from '@/lib/calendar/server';
import styles from './calendar.module.css';

export interface CalDivision {
  id: string;
  name: string;
  slug: string;
  accent: string;
}
export interface CalState {
  view: CalView;
  date: string;
  /** Kinds switched off. */
  hide: CalKind[];
  /** '' everyone, 'club' only Triton Gaming's, otherwise a division id. */
  div: string;
  mine: boolean;
}

const VIEW_LABEL: Record<CalView, string> = { month: 'Month', week: 'Week', agenda: 'List' };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthTitle = (day: string) => new Date(`${day.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
function titleOf(view: CalView, date: string) {
  if (view !== 'week') return monthTitle(date);
  const from = startOfWeek(date);
  const to = addDaysKey(from, 6);
  return `${formatPacificDate(from)} to ${formatPacificDate(to, { year: true })}`;
}

/** The quarter a day is in, and which week of it ("Fall 2026, week 6"). Weeks run Sunday to Saturday, week 1 holding the first day. */
function termOn(terms: CalTerm[], day: string): { name: string; week: number } | null {
  const t = terms.find((x) => day >= x.start && day <= x.end);
  if (!t) return null;
  return { name: t.name, week: Math.floor(daysBetweenKeys(startOfWeek(t.start), startOfWeek(day)) / 7) + 1 };
}

const whenOf = (it: CalItem) => {
  if (it.allDay) return null;
  const a = formatPacificTime(it.start);
  return it.end && it.end > it.start ? `${a} to ${formatPacificTime(it.end)}` : a;
};
const dayLine = (it: CalItem) => {
  const first = it.allDay ? it.start : it.start;
  const last = it.allDay ? (it.end ?? it.start) : (it.end ?? it.start);
  const a = formatPacificDate(first, { weekday: true, year: true });
  const b = formatPacificDate(last, { weekday: true, year: true });
  return a === b ? a : `${a} to ${b}`;
};

/** One calendar for both places it shows: the portal's (everything a person can see or is part of) and the public website's (what is published for everyone). It loads its own data from `endpoint`; the page owns which view, date and filters are on, so they can live in its address. */
export default function CalendarView({
  endpoint,
  state,
  onState,
  divisions,
  tone,
  toolbarExtra,
  signedInView,
}: {
  endpoint: string;
  state: CalState;
  onState: (patch: Partial<CalState>) => void;
  divisions: CalDivision[];
  tone: 'portal' | 'site';
  toolbarExtra?: ReactNode;
  /** The portal view has a "Mine only" switch and leans on the person's own marks. */
  signedInView: boolean;
}) {
  const { view, date, hide, div, mine } = state;
  const today = pacificToday();
  const range = useMemo(() => viewRange(view, date), [view, date]);
  const [data, setData] = useState<CalendarData | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<CalItem | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  // What is fetched: the days in view; for the public calendar also one division's, asked of the server.
  const divSlug = tone === 'site' && div && div !== 'club' ? (divisions.find((d) => d.id === div)?.slug ?? '') : '';
  useEffect(() => {
    const ac = new AbortController();
    const q = new URLSearchParams({ from: range.from, to: range.to });
    if (divSlug) q.set('division', divSlug);
    fetch(`${endpoint}?${q}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((d: CalendarData) => {
        setData(d);
        setFailed(false);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setFailed(true);
      });
    return () => ac.abort();
  }, [endpoint, range.from, range.to, divSlug]);

  const divName = useMemo(() => new Map(divisions.map((d) => [d.id, d])), [divisions]);
  const all = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(() => {
    const c: Partial<Record<CalKind, number>> = {};
    for (const it of all) c[it.kind] = (c[it.kind] ?? 0) + 1;
    return c;
  }, [all]);
  const shown = useMemo(
    () =>
      all.filter((it) => {
        if (hide.includes(it.kind)) return false;
        if (mine && !it.mine && it.kind !== 'term' && it.kind !== 'holiday') return false;
        if (div === 'club') return !it.divisionId;
        if (div) return it.divisionId === div;
        return true;
      }),
    [all, hide, mine, div],
  );
  const byDay = useMemo(() => groupByDay(shown, range.from, range.to), [shown, range.from, range.to]);
  const terms = data?.terms ?? [];
  const quarter = termOn(terms, view === 'month' ? (today >= range.from && today <= range.to ? today : date) : date);
  const dayItems = (d: string) => byDay.get(d) ?? [];
  const selected =
    picked && picked >= range.from && picked <= range.to
      ? picked
      : today >= range.from && today <= range.to
        ? today
        : date.slice(0, 7) === range.from.slice(0, 7)
          ? date
          : range.from;

  const go = (dir: -1 | 1) => onState({ date: stepDate(view, date, dir) });
  const toggleKind = (k: CalKind) => onState({ hide: hide.includes(k) ? hide.filter((x) => x !== k) : [...hide, k] });

  const Row = ({ it, day }: { it: CalItem; day?: string }) => {
    const d = it.divisionId ? divName.get(it.divisionId) : null;
    const when = whenOf(it);
    return (
      <button type="button" className={styles.row} onClick={() => setOpen(it)} style={{ ['--k' as string]: KIND_INFO[it.kind].color }}>
        <i className={styles.bar} aria-hidden="true" />
        <span className={styles.rowMain}>
          <b>{it.title}</b>
          <small>{[when ?? (day && it.end && it.end > it.start ? 'Continues' : 'All day'), it.location, d?.name, it.note].filter(Boolean).join(' · ')}</small>
        </span>
        <span className={styles.rowTags}>
          {it.mine && signedInView && <em className={styles.mine}>Yours</em>}
          <em className={styles.kind}>{KIND_INFO[it.kind].label}</em>
        </span>
      </button>
    );
  };

  const dayHead = (d: string) => (
    <h3 className={`${styles.dayHead} ${d === today ? styles.todayHead : ''}`}>
      {formatPacificDate(d, { weekday: true, long: true })}
      {d === today && <em>Today</em>}
    </h3>
  );

  const agendaDays = daysIn(range.from, range.to).filter((d) => dayItems(d).length > 0);
  const weekDays = daysIn(range.from, range.to);

  return (
    <div className={`${styles.cal} ${tone === 'site' ? styles.site : styles.portal}`}>
      <div className={styles.bar2}>
        <div className={styles.nav}>
          <button type="button" className={styles.navBtn} aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => go(-1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className={styles.navBtn} aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => go(1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <h2 className={styles.title}>{titleOf(view, date)}</h2>
          <button type="button" className={styles.todayBtn} onClick={() => onState({ date: today })}>
            Today
          </button>
        </div>
        <div className={styles.seg} role="tablist" aria-label="View">
          {CAL_VIEWS.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? styles.segOn : ''} onClick={() => onState({ view: v })}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        {toolbarExtra}
      </div>

      {quarter && (
        <p className={styles.quarter}>
          <b>{quarter.name}</b> · Week {quarter.week}
        </p>
      )}

      <div className={styles.filters}>
        <div className={styles.chips} role="group" aria-label="Show">
          {CAL_KINDS.filter((k) => counts[k] || hide.includes(k)).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={!hide.includes(k)}
              className={`${styles.chip} ${hide.includes(k) ? styles.chipOff : ''}`}
              style={{ ['--k' as string]: KIND_INFO[k].color }}
              onClick={() => toggleKind(k)}
            >
              <i aria-hidden="true" />
              {KIND_INFO[k].plural}
              <small>{counts[k] ?? 0}</small>
            </button>
          ))}
        </div>
        <div className={styles.sel}>
          {divisions.length > 0 && (
            <label>
              <span>From</span>
              <select value={div} onChange={(e) => onState({ div: e.target.value })}>
                <option value="">Everyone</option>
                <option value="club">Triton Gaming</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {signedInView && (
            <label className={styles.check}>
              <input type="checkbox" checked={mine} onChange={(e) => onState({ mine: e.target.checked })} />
              Only Mine
            </label>
          )}
        </div>
      </div>

      {failed && <p className={styles.msg}>The calendar could not load. Try again in a moment.</p>}
      {!data && !failed && <p className={styles.msg}>Loading the calendar…</p>}

      {data && view === 'month' && (
        <>
          <div className={styles.month} role="grid" aria-label={monthTitle(date)}>
            {WEEKDAYS.map((w) => (
              <div key={w} className={styles.wd} role="columnheader">
                {w}
              </div>
            ))}
            {daysIn(range.from, range.to).map((d) => {
              const list = dayItems(d);
              const out = d.slice(0, 7) !== date.slice(0, 7);
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  aria-label={`${formatPacificDate(d, { weekday: true, long: true })}, ${list.length} ${list.length === 1 ? 'item' : 'items'}`}
                  className={`${styles.cell} ${out ? styles.out : ''} ${d === today ? styles.today : ''} ${d === selected ? styles.sel2 : ''}`}
                  onClick={() => setPicked(d)}
                  onDoubleClick={() => onState({ view: 'week', date: d })}
                >
                  <span className={styles.num}>{+d.slice(8)}</span>
                  <span className={styles.chips2}>
                    {list.slice(0, 3).map((it) => (
                      <span key={it.id} className={styles.mini} style={{ ['--k' as string]: KIND_INFO[it.kind].color }}>
                        {it.title}
                      </span>
                    ))}
                    {list.length > 3 && <small className={styles.more}>+{list.length - 3} more</small>}
                  </span>
                  <span className={styles.dots} aria-hidden="true">
                    {list.slice(0, 4).map((it) => (
                      <i key={it.id} style={{ background: KIND_INFO[it.kind].color }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <section className={styles.panel} aria-live="polite">
            {dayHead(selected)}
            {dayItems(selected).length === 0 ? <p className={styles.empty}>Nothing on this day.</p> : dayItems(selected).map((it) => <Row key={it.id} it={it} day={selected} />)}
          </section>
        </>
      )}

      {data && view === 'week' && (
        <div className={styles.week}>
          {weekDays.map((d) => {
            const t = termOn(terms, d);
            return (
              <section key={d} className={`${styles.wcol} ${d === today ? styles.wToday : ''}`}>
                {dayHead(d)}
                {t && d === weekDays[0] && <small className={styles.wk}>Week {t.week}</small>}
                {dayItems(d).length === 0 ? <p className={styles.empty}>Nothing</p> : dayItems(d).map((it) => <Row key={it.id} it={it} day={d} />)}
              </section>
            );
          })}
        </div>
      )}

      {data && view === 'agenda' && (
        <div className={styles.agenda}>
          {agendaDays.length === 0 && <p className={styles.empty}>Nothing this month.</p>}
          {agendaDays.map((d) => (
            <section key={d}>
              {dayHead(d)}
              {dayItems(d).map((it) => (
                <Row key={it.id} it={it} day={d} />
              ))}
            </section>
          ))}
        </div>
      )}

      {open && <Detail item={open} canRegister={signedInView} divName={open.divisionId ? divName.get(open.divisionId)?.name : undefined} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Detail({ item, divName, canRegister, onClose }: { item: CalItem; divName?: string; canRegister: boolean; onClose: () => void }) {
  const [reg, setReg] = useState<'idle' | 'working' | 'done'>('idle');
  const [regMsg, setRegMsg] = useState('');
  // An event the person has no ticket for yet can be registered for right here (the event page's own button does the same).
  const eventId = item.id.startsWith('event:') ? item.id.slice(6) : null;
  const canGet = canRegister && !item.mine && !!eventId && !!item.href?.startsWith('/events/');
  async function register() {
    if (!eventId) return;
    setReg('working');
    setRegMsg('');
    try {
      const res = await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: eventId, source: 'calendar' }) });
      const data = await res.json();
      if (res.status === 409) return setReg('done');
      if (!res.ok) {
        if (data.needsProfile) return void (window.location.href = `/portal/finish-profile?next=/me/calendar&mode=ticket&event=${eventId}`);
        setRegMsg(data.error || 'Something went wrong. Please try again.');
        return setReg('idle');
      }
      if (data.url) return void (window.location.href = data.url);
      setReg('done');
    } catch {
      setRegMsg('Could not reach the site. Try again.');
      setReg('idle');
    }
  }
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const when = whenOf(item);
  const download = () => {
    const blob = new Blob([buildIcs([item], { name: item.title, origin })], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = icsFileName(item);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <Dialog title={item.title} onClose={onClose}>
      <div className={styles.detail}>
        <p className={styles.dKind} style={{ ['--k' as string]: KIND_INFO[item.kind].color }}>
          <i aria-hidden="true" />
          {KIND_INFO[item.kind].label}
          {divName ? ` · ${divName}` : item.divisionId ? '' : ' · Triton Gaming'}
        </p>
        <p>
          <b>{dayLine(item)}</b>
          {when && <> · {when}</>}
        </p>
        {item.location && (
          <p className={styles.dLine}>
            <MapPin size={15} aria-hidden="true" /> {item.location}
          </p>
        )}
        {item.note && <p>{item.note}</p>}
        {regMsg && (
          <p role="alert" style={{ color: 'var(--pp-bad)' }}>
            {regMsg}
          </p>
        )}
        <div className={styles.dActions}>
          {canGet && reg !== 'done' && (
            <Button onClick={register} loading={reg === 'working'}>
              Register
            </Button>
          )}
          {reg === 'done' && (
            <Link href="/me/tickets" className={styles.open} onClick={onClose}>
              You’re going · Show Ticket
            </Link>
          )}
          {item.href && reg !== 'done' && (
            <Link href={item.href} className={styles.open} onClick={onClose}>
              <ExternalLink size={15} aria-hidden="true" /> Open
            </Link>
          )}
        </div>
        {
          <div className={styles.add}>
            <span>
              <CalendarPlus size={15} aria-hidden="true" /> Add To Your Calendar
            </span>
            <div>
              <a href={googleLink(item, origin)} target="_blank" rel="noreferrer">
                Google
              </a>
              <a href={outlookLink(item, origin)} target="_blank" rel="noreferrer">
                Outlook
              </a>
              <Button size="sm" variant="secondary" onClick={download}>
                <Download size={14} aria-hidden="true" /> Apple / File
              </Button>
            </div>
          </div>
        }
      </div>
    </Dialog>
  );
}
