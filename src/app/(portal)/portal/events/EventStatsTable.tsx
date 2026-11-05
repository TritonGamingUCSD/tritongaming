'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { formatPacificDate } from '@/lib/core/timezone';
import { textCodec, useAddressState, wordCodec } from '@/lib/portal/usePageState';
import type { Bucket } from '@/lib/events/eventSummary';
import type { EventStatsRow } from '@/app/api/events/stats/route';
import styles from './eventStats.module.css';

type Mode = 'count' | 'pct';
type Cell = string | number | null;
interface Col {
  key: string;
  label: string;
  group: string;
  align?: 'left' | 'right';
  value: (r: EventStatsRow) => Cell;
  /** Counts can be added up in the bottom row; percentages and text cannot. */
  sum?: boolean;
  /** The value is a percent: drawn with a % sign. */
  pct?: boolean;
  title?: string;
}

const GROUPS: { id: string; label: string }[] = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'newcomers', label: 'First-time & returning' },
  { id: 'timing', label: 'Timing' },
  { id: 'tickets', label: 'Tickets & sources' },
  { id: 'money', label: 'Money, points & feedback' },
  { id: 'year', label: 'Year' },
  { id: 'college', label: 'College' },
  { id: 'major', label: 'Major & field' },
  { id: 'gender', label: 'Gender & pronouns' },
  { id: 'interests', label: 'Games & platforms' },
];

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 1000) / 10 : null);
const attended = (r: EventStatsRow) => r.s.checkedIn;
const registered = (r: EventStatsRow) => r.s.registered;

// One column for every label that shows up in a breakdown, most common first. A count (or the share of the people who came, or of the tickets) for each event.
function bucketCols(rows: EventStatsRow[], group: string, prefix: string, pick: (r: EventStatsRow) => Bucket[], base: (r: EventStatsRow) => number, mode: Mode, max = 12): Col[] {
  const total = new Map<string, number>();
  for (const r of rows) for (const b of pick(r)) if (b.label !== 'Other') total.set(b.label, (total.get(b.label) ?? 0) + b.count);
  return [...total.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([label]) => ({
      key: `${group}:${prefix}:${label}`,
      label: prefix ? `${prefix}: ${label}` : label,
      group,
      align: 'right' as const,
      sum: mode === 'count',
      pct: mode === 'pct',
      value: (r) => {
        const c = pick(r).find((b) => b.label === label)?.count ?? 0;
        return mode === 'count' ? c : pct(c, base(r));
      },
    }));
}

function buildCols(rows: EventStatsRow[], mode: Mode): Col[] {
  const n = (key: string, label: string, group: string, value: (r: EventStatsRow) => Cell, extra: Partial<Col> = {}): Col => ({
    key,
    label,
    group,
    align: 'right',
    value,
    sum: true,
    ...extra,
  });
  const money = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
  const peak = (r: EventStatsRow) => [...r.s.arrivals].filter((b) => b.label !== 'Other times').sort((a, b) => b.count - a.count)[0];
  return [
    n('registered', 'Registered', 'attendance', (r) => r.s.registered),
    n('checkedIn', 'Checked in', 'attendance', (r) => r.s.checkedIn),
    n('noShows', 'No-shows', 'attendance', (r) => r.s.noShows),
    n('rate', 'Attendance %', 'attendance', (r) => r.s.attendanceRate, { sum: false, pct: true }),
    n('cancelled', 'Cancelled', 'attendance', (r) => r.s.cancelled),
    n('form', 'Opened check-in form', 'attendance', (r) => r.s.formOpened, { title: 'Only for events that ask for the form' }),
    n('allDays', 'Came every day', 'attendance', (r) => r.s.allDays, { title: 'Multi-day events only' }),

    n('first', 'First event', 'newcomers', (r) => (mode === 'count' ? r.s.firstTime : pct(r.s.firstTime, attended(r))), { sum: mode === 'count', pct: mode === 'pct' }),
    n('returning', 'Returning', 'newcomers', (r) => (mode === 'count' ? r.s.returning : pct(r.s.returning, attended(r))), { sum: mode === 'count', pct: mode === 'pct' }),
    ...bucketCols(rows, 'newcomers', 'Has been to', (r) => r.s.repeat.filter((b) => b.label !== 'First event'), attended, mode, 3),
    n('members', 'Members', 'newcomers', (r) => (r.s.members == null ? null : mode === 'count' ? r.s.members : pct(r.s.members, attended(r))), {
      title: 'Public events only',
      sum: mode === 'count',
      pct: mode === 'pct',
    }),
    n('guests', 'Guests', 'newcomers', (r) => (r.s.guests == null ? null : mode === 'count' ? r.s.guests : pct(r.s.guests, attended(r))), {
      title: 'Public events only',
      sum: mode === 'count',
      pct: mode === 'pct',
    }),

    { key: 'peakTime', label: 'Busiest arrival', group: 'timing', value: (r) => peak(r)?.label ?? null },
    n('peakCount', 'Arrived then', 'timing', (r) => peak(r)?.count ?? null, { sum: false }),
    ...bucketCols(rows, 'timing', 'Claimed', (r) => r.s.claimTiming, registered, mode, 6),

    n('paid', 'Paid tickets', 'tickets', (r) => r.s.paid),
    n('revenue', 'Revenue ($)', 'tickets', (r) => money(r.s.revenue)),
    ...bucketCols(rows, 'tickets', 'Source', (r) => r.s.sources, registered, mode, 8),

    n('points', 'Points awarded', 'money', (r) => r.s.pointsAwarded),
    n('perHead', 'Points per attendee', 'money', (r) => (r.s.checkedIn ? Math.round((r.s.pointsAwarded / r.s.checkedIn) * 10) / 10 : null), { sum: false }),
    n('ratings', 'Ratings', 'money', (r) => r.s.feedback.count),
    n('avg', 'Average rating', 'money', (r) => r.s.feedback.average, { sum: false, title: 'Shown from 8 ratings' }),

    ...bucketCols(rows, 'year', '', (r) => r.s.year, attended, mode),
    ...bucketCols(rows, 'college', '', (r) => r.s.college, attended, mode),
    ...bucketCols(rows, 'major', 'Field', (r) => r.s.field, attended, mode, 10),
    ...bucketCols(rows, 'major', 'Major', (r) => r.s.major, attended, mode, 12),
    n('double', 'Double majors', 'major', (r) => (mode === 'count' ? r.s.doubleMajors : pct(r.s.doubleMajors, attended(r))), { sum: mode === 'count', pct: mode === 'pct' }),
    ...bucketCols(rows, 'gender', 'Gender', (r) => r.s.gender, attended, mode),
    ...bucketCols(rows, 'gender', 'Pronouns', (r) => r.s.pronouns, attended, mode),
    ...bucketCols(rows, 'interests', 'Plays on', (r) => r.s.platforms, attended, mode, 8),
    ...bucketCols(rows, 'interests', 'Game', (r) => r.s.games, attended, mode, 10),
    ...bucketCols(rows, 'interests', 'Interested in', (r) => r.s.divisions, attended, mode, 8),
  ];
}

const show = (v: Cell, col: Col): string => (v == null || v === '' ? '–' : col.pct && typeof v === 'number' ? `${v}%` : String(v));

// Every past event in one table: a row per event, a column for each number the report has (and each answer in the breakdowns). Sort by any column, hide groups of columns, switch between counts and shares,
// copy it as text for a sheet. Aggregates only, never named people.
export default function EventStatsTable() {
  const [rows, setRows] = useState<EventStatsRow[] | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useAddressState('stats', wordCodec(['count', 'pct'] as const, 'count'));
  const [last, setLast] = useAddressState('last', wordCodec(['24', '12', '48'] as const, '24'));
  const [sort, setSort] = useAddressState('sort', textCodec); // a column key, with a leading "-" for high to low
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setRows(null);
    setError('');
    fetch(`/api/events/stats?limit=${last}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(j.error || 'Could not load the numbers.');
        else setRows(j.rows as EventStatsRow[]);
      })
      .catch(() => live && setError('Network error loading the numbers.'));
    return () => {
      live = false;
    };
  }, [last]);

  const cols = useMemo(() => (rows ? buildCols(rows, mode as Mode) : []), [rows, mode]);
  const visible = cols.filter((c) => !hidden.has(c.group));
  const sortKey = sort.replace(/^-/, '') || 'date';
  const desc = sort ? sort.startsWith('-') : true; // newest event first until a column is chosen
  const sorted = useMemo(() => {
    if (!rows) return [];
    const col = cols.find((c) => c.key === sortKey);
    const get = (r: EventStatsRow): Cell => (sortKey === 'date' ? r.start_date : sortKey === 'title' ? r.title : col ? col.value(r) : r.start_date);
    const out = [...rows].sort((a, b) => {
      const x = get(a),
        y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    });
    return desc ? out.reverse() : out;
  }, [rows, cols, sortKey, desc]);

  // First press: low to high (names: A to Z); second: high to low; third: back to newest first.
  const setSortBy = (key: string) => setSort(!sort || sortKey !== key ? key : !desc ? `-${key}` : '');
  const toggle = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const textOf = () => {
    const head = ['Event', 'Date', ...visible.map((c) => c.label)];
    const lines = sorted.map((r) => [r.title, formatPacificDate(r.start_date, { year: true }), ...visible.map((c) => show(c.value(r), c))]);
    return [head, ...lines].map((l) => l.join('\t')).join('\n');
  };
  async function copy() {
    try {
      await navigator.clipboard.writeText(textOf());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy; the browser blocked it.');
    }
  }

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!rows) return <Loading variant="inline" label="Adding up every event…" />;
  if (rows.length === 0) return <p className={styles.none}>No past events yet.</p>;

  const th = (key: string, label: string, align: 'left' | 'right' = 'right', title?: string) => (
    <th
      key={key}
      scope="col"
      aria-sort={sortKey === key ? (desc ? 'descending' : 'ascending') : 'none'}
      className={`${styles.th} ${align === 'left' ? styles.left : ''}`}
      title={title}
    >
      <button type="button" className={styles.sortBtn} onClick={() => setSortBy(key)}>
        {label}
        {sortKey === key && (desc ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />)}
      </button>
    </th>
  );

  return (
    <section className={styles.wrap} aria-label="Event numbers">
      <div className={styles.bar}>
        <div className={styles.seg} role="group" aria-label="Show as">
          {(['count', 'pct'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? styles.segOn : ''} onClick={() => setMode(m)}>
              {m === 'count' ? 'Counts' : 'Percent'}
            </button>
          ))}
        </div>
        <label className={styles.select}>
          <span>Events</span>
          <select value={last} onChange={(e) => setLast(e.target.value as '12' | '24' | '48')}>
            <option value="12">Last 12</option>
            <option value="24">Last 24</option>
            <option value="48">Last 48</option>
          </select>
        </label>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? 'Copied' : 'Copy as text'}
        </button>
      </div>
      <div className={styles.chips} role="group" aria-label="Column groups">
        {GROUPS.filter((g) => cols.some((c) => c.group === g.id)).map((g) => (
          <button key={g.id} type="button" aria-pressed={!hidden.has(g.id)} className={`${styles.chip} ${hidden.has(g.id) ? '' : styles.chipOn}`} onClick={() => toggle(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <p className={styles.note}>
        {mode === 'pct'
          ? 'Percent of the people who checked in (claim timing and sources: of the tickets). Majors, games and platforms can add up to more than 100.'
          : 'Counts of people.'}{' '}
        A dash means not tracked for that event.
      </p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {th('title', 'Event', 'left')}
              {th('date', 'Date', 'left')}
              {visible.map((c) => th(c.key, c.label, c.align ?? 'right', c.title))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className={styles.row}>
                <th scope="row" className={`${styles.td} ${styles.event}`}>
                  <Link href={`/portal/events/${r.id}/summary`} title="Open the report">
                    {r.title}
                  </Link>
                </th>
                <td className={`${styles.td} ${styles.left} ${styles.date}`}>{formatPacificDate(r.start_date, { year: true })}</td>
                {visible.map((c) => (
                  <td key={c.key} className={`${styles.td} ${c.align === 'left' ? styles.left : ''}`}>
                    {show(c.value(r), c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className={styles.foot}>
            <tr>
              <th scope="row" className={`${styles.td} ${styles.event}`}>
                Total ({sorted.length} events)
              </th>
              <td className={styles.td} />
              {visible.map((c) => (
                <td key={c.key} className={styles.td}>
                  {c.sum && sorted.some((r) => c.value(r) != null) ? sorted.reduce((n, r) => n + (Number(c.value(r)) || 0), 0).toLocaleString() : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
