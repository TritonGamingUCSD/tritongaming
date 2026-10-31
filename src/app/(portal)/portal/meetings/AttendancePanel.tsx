'use client';

import { pacificToday, addDaysKey } from '@/lib/core/timezone';
import Loading from '@/components/Loading/Loading';
import { useEffect, useState } from 'react';
import { Download, CalendarX } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { audienceLabel } from '@/lib/meetings/meetingAudience';
import styles from './meetings.module.css';
import Link from 'next/link';
import { RANGES, dayLabel } from './format';
import { AttData, AttPerson, SortKey } from './types';
import { PersonRow } from './PersonRow';

export function AttendancePanel({ onOpenMeeting, canExport }: { onOpenMeeting?: (id: string) => void; canExport: boolean }) {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('90');
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [onlyFollowUp, setOnlyFollowUp] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rate', dir: 1 });
  const [data, setData] = useState<AttData | null>(null);
  const [error, setError] = useState('');
  const [showMeetings, setShowMeetings] = useState(false);
  const [showAllPeople, setShowAllPeople] = useState(false);

  const to = pacificToday();
  const from = addDaysKey(to, -(RANGES.find((r) => r.id === range)?.days ?? 90));
  const qs = `from=${from}&to=${to}${title ? `&title=${encodeURIComponent(title)}` : ''}`;

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    (async () => {
      try {
        const res = await fetch(`/api/meetings/attendance?${qs}`, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(json.error || 'Failed to load.');
        else setData(json);
      } catch {
        if (!cancelled) setError('Network error.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  const people = (data?.people ?? [])
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()) && (!onlyFollowUp || p.follow_up))
    .sort((a, b) => {
      const v = (p: AttPerson) =>
        sort.key === 'name'
          ? p.name.toLowerCase()
          : sort.key === 'rate'
            ? (p.rate ?? -1)
            : sort.key === 'attended'
              ? p.attended
              : sort.key === 'streak'
                ? p.streak
                : (p.last_attended ?? '');
      const x = v(a),
        y = v(b);
      return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)) * sort.dir;
    });

  // Who needs a follow-up goes first, in its own card; everyone else sits below (a search or the Follow Up tile shows one flat list).
  const followUp = people.filter((p) => p.follow_up);
  const rest = !query && !onlyFollowUp ? people.filter((p) => !p.follow_up) : people;
  const th = (key: SortKey, label: string) => (
    <button
      type="button"
      className={`${styles.thBtn} ${sort.key === key ? styles.thOn : ''}`}
      onClick={() => setSort((s) => (s.key === key ? { key, dir: -s.dir as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }))}
    >
      {label}
      {sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </button>
  );
  const maxBar = Math.max(1, ...(data?.meetings ?? []).map((m) => Math.max(m.count, m.expected)));
  const bars = (data?.meetings ?? []).slice(-40);

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <Field label="Time range">
          <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)}>
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Meeting">
          <Select value={title} onChange={(e) => setTitle(e.target.value)}>
            <option value="">All meetings</option>
            {(data?.titles ?? (title ? [title] : [])).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        {canExport && (
          <div className={styles.exportBtns}>
            <a className={styles.docBtn} href={`/api/meetings/export?type=log&${qs}`}>
              <Download size={15} aria-hidden="true" /> Log (CSV)
            </a>
            <a className={styles.docBtn} href={`/api/meetings/export?type=summary&${qs}`}>
              <Download size={15} aria-hidden="true" /> Summary (CSV)
            </a>
          </div>
        )}
      </div>
      {canExport ? <p className={styles.faint}>Exports follow these filters.</p> : <p className={styles.faint}>Your meetings’ results.</p>}

      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <Loading label="Loading attendance…" />}
      {data && data.meetings.length === 0 && (
        <div className={styles.card}>
          <p className={styles.muted}>No meetings in this range.</p>
        </div>
      )}

      {data && data.meetings.length > 0 && (
        <>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <strong>{data.summary.held}</strong>
              <span>meetings held</span>
            </div>
            <div className={styles.tile}>
              <strong>{data.summary.avgTurnout}</strong>
              <span>average turnout</span>
            </div>
            <div className={styles.tile}>
              <strong>{data.summary.avgRate === null ? '–' : `${Math.round(data.summary.avgRate * 100)}%`}</strong>
              <span>average attendance</span>
            </div>
            <button
              type="button"
              className={`${styles.tile} ${styles.tileBtn} ${onlyFollowUp ? styles.tileOn : ''}`}
              onClick={() => setOnlyFollowUp((v) => !v)}
              aria-pressed={onlyFollowUp}
            >
              <strong>{data.summary.followUp}</strong>
              <span>to follow up{onlyFollowUp ? ' (showing)' : ''}</span>
            </button>
          </div>

          <section className={styles.card}>
            <h3 className={styles.listTitle}>
              Turnout <span>each bar is a meeting, outline = people expected</span>
            </h3>
            <div className={styles.trend} role="img" aria-label="Turnout per meeting">
              {bars.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={styles.trendCol}
                  onClick={() => onOpenMeeting?.(m.id)}
                  title={`${dayLabel(m.meeting_date)} · ${m.title}: ${m.count} of ${m.expected}${m.guests > 0 ? `, plus ${m.guests}` : ''}`}
                >
                  <span className={styles.trendBar} style={{ height: `${(Math.max(m.count, m.expected) / maxBar) * 100}%` }}>
                    <span className={styles.trendFill} style={{ height: `${m.expected || m.count ? Math.min(100, (m.count / Math.max(m.count, m.expected)) * 100) : 0}%` }} />
                  </span>
                  <small>{new Date(`${m.meeting_date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric' })}</small>
                </button>
              ))}
            </div>
          </section>

          {followUp.length > 0 && !query && !onlyFollowUp && (
            <section className={`${styles.card} ${styles.followCard}`}>
              <div className={styles.tableHead}>
                <h3 className={styles.listTitle}>
                  Follow Up{' '}
                  <span>
                    {followUp.length} {followUp.length === 1 ? 'person' : 'people'} under 50% or missing the last 3
                  </span>
                </h3>
                {canExport && (
                  <Link href="/portal/strikes/missed" className={styles.docBtn}>
                    <CalendarX size={15} aria-hidden="true" /> Review Missed Meetings
                  </Link>
                )}
              </div>
              <ul className={styles.people}>
                {followUp.map((p) => (
                  <PersonRow key={p.id} p={p} meetings={data.meetings} />
                ))}
              </ul>
            </section>
          )}

          <section className={styles.card}>
            <div className={styles.tableHead}>
              <h3 className={styles.listTitle}>
                {followUp.length > 0 && !query && !onlyFollowUp ? 'Everyone Else' : 'People'} <span>{rest.length} shown</span>
              </h3>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" aria-label="Search people" className={styles.searchBox} />
            </div>
            <div className={styles.sortRow}>
              Sort: {th('rate', 'Rate')} {th('attended', 'Attended')} {th('streak', 'Streak')} {th('last', 'Last seen')} {th('name', 'Name')}
            </div>
            {rest.length === 0 ? (
              <p className={styles.muted}>{people.length === 0 ? 'No one matches.' : 'Everyone else is on track.'}</p>
            ) : (
              <ul className={styles.people}>
                {(showAllPeople || query || onlyFollowUp ? rest : rest.slice(0, 20)).map((p) => (
                  <PersonRow key={p.id} p={p} meetings={data.meetings} />
                ))}
              </ul>
            )}
            {!showAllPeople && !query && !onlyFollowUp && rest.length > 20 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllPeople(true)}>
                Show all {rest.length}
              </Button>
            )}
            <p className={`${styles.faint} ${styles.dotKey}`}>
              <span>
                <i style={{ background: '#34d399' }} /> came
              </span>
              <span>
                <i style={{ background: '#f87171' }} /> missed
              </span>
              <span>
                <i style={{ boxShadow: 'inset 0 0 0 2px #fbbf24' }} /> excused
              </span>
              <span title="Under 50%, or the last 3 expected meetings missed">⚑ follow up</span>
            </p>
          </section>

          <section className={styles.card}>
            <button type="button" className={styles.collapse} onClick={() => setShowMeetings((v) => !v)} aria-expanded={showMeetings}>
              <h3 className={styles.listTitle}>
                Meetings <span>{data.meetings.length}</span>
              </h3>
              <span>{showMeetings ? 'Hide' : 'Show'}</span>
            </button>
            {showMeetings && (
              <ul className={styles.people}>
                {[...data.meetings].reverse().map((m) => (
                  <li key={m.id} className={styles.person}>
                    <span className={styles.personName}>
                      {dayLabel(m.meeting_date)}
                      <em>
                        {' '}
                        · {m.title} · {audienceLabel(m)}
                      </em>
                    </span>
                    <span className={styles.count}>
                      {m.count}/{m.expected}
                      {m.guests > 0 ? ` +${m.guests}` : ''}
                    </span>
                    {onOpenMeeting && (
                      <Button size="sm" variant="ghost" onClick={() => onOpenMeeting(m.id)}>
                        Open
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
