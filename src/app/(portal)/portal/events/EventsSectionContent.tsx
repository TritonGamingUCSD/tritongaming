'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Search, Plus, Ticket, MapPin, BarChart3, ListChecks } from 'lucide-react';
import { PACIFIC_TZ } from '@/lib/timezone';
import type { MonthPoint } from '@/lib/monthBuckets';
import type { EventTicketStat } from './getEventsData';
import EventCheckinsModal from './EventCheckinsModal';
import styles from './events.module.css';
import chartStyles from '../admin/stats/stats.module.css';

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  is_published: boolean;
  requires_ticket: boolean;
  max_capacity: number | null;
  audience: 'public' | 'ucsd_only';
  ticketsIssued: number;
  ticketsCheckedIn: number;
}

type StatusFilter = 'all' | 'upcoming' | 'past' | 'draft';
type Tab = 'manage' | 'analytics';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'draft', label: 'Drafts' },
];

const TOOLTIP_STYLE = {
  background: 'rgba(10, 15, 28, 0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  fontSize: 12,
  color: '#f2f1f0',
};
const AXIS_STYLE = { fontSize: 11, fill: 'rgba(242,241,240,0.5)' };

interface Props {
  events: EventRow[];
  eventsPerMonth: MonthPoint[];
  ticketsPerMonth: MonthPoint[];
  eventStats: EventTicketStat[];
  canEdit: boolean;
}

// Shared between the standalone /portal/events page and the portal hub's
// Events panel, so the two never drift apart visually. Now a client
// component — search + status filter are pure UI state over data that's
// already fully fetched (all events + their ticket counts come in as
// props), so filtering is instant with no round trip.
export default function EventsSectionContent({ events, eventsPerMonth, ticketsPerMonth, eventStats, canEdit }: Props) {
  const [tab, setTab] = useState<Tab>('manage');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [checkinsEventId, setCheckinsEventId] = useState<string | null>(null);

  const now = Date.now();

  const counts = useMemo(() => ({
    all: events.length,
    upcoming: events.filter((e) => new Date(e.start_date).getTime() >= now).length,
    past: events.filter((e) => new Date(e.start_date).getTime() < now).length,
    draft: events.filter((e) => !e.is_published).length,
  }), [events, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (filter === 'upcoming' && new Date(e.start_date).getTime() < now) return false;
        if (filter === 'past' && new Date(e.start_date).getTime() >= now) return false;
        if (filter === 'draft' && e.is_published) return false;
        if (q && !e.title.toLowerCase().includes(q) && !(e.location ?? '').toLowerCase().includes(q)) return false;
        return true;
      });
  }, [events, filter, query, now]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{canEdit ? 'Event Management' : 'Events'}</h1>
        {canEdit && (
          <Link href="/portal/events/new" className={styles.newBtn}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" /> Create Event
          </Link>
        )}
      </div>

      {canEdit && (
        <div className={styles.tabBar} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'manage'} className={`${styles.tab} ${tab === 'manage' ? styles.tabActive : ''}`} onClick={() => setTab('manage')}>
            <ListChecks size={13} strokeWidth={1.5} aria-hidden="true" /> Manage
          </button>
          <button type="button" role="tab" aria-selected={tab === 'analytics'} className={`${styles.tab} ${tab === 'analytics' ? styles.tabActive : ''}`} onClick={() => setTab('analytics')}>
            <BarChart3 size={13} strokeWidth={1.5} aria-hidden="true" /> Analytics
          </button>
        </div>
      )}

      {tab === 'analytics' && canEdit && (
        eventsPerMonth.length === 0 && ticketsPerMonth.length === 0 && eventStats.length === 0 ? (
          <div className={styles.empty}><p>Not enough data yet to chart trends.</p></div>
        ) : (
          <div className={styles.analyticsCharts}>
            <div className={chartStyles.chartRow}>
              {eventsPerMonth.length > 0 && (
                <section className={chartStyles.chartCard}>
                  <h2 className={chartStyles.chartTitle}>Events Created / Month</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={eventsPerMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="month" tick={AXIS_STYLE} />
                      <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" name="Events" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              )}

              {ticketsPerMonth.length > 0 && (
                <section className={chartStyles.chartCard}>
                  <h2 className={chartStyles.chartTitle}>Tickets Issued / Month</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={ticketsPerMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="month" tick={AXIS_STYLE} />
                      <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="count" name="Tickets" stroke="#34d399" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </section>
              )}
            </div>

            {eventStats.length > 0 && (
              <>
                <section className={chartStyles.chartCard}>
                  <h2 className={chartStyles.chartTitle}>Ticket Sales & Attendance by Event (most recent)</h2>
                  <ResponsiveContainer width="100%" height={Math.max(240, eventStats.length * 34)}>
                    <BarChart data={eventStats} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" tick={AXIS_STYLE} allowDecimals={false} />
                      <YAxis type="category" dataKey="title" tick={{ ...AXIS_STYLE, fontSize: 10 }} width={150} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="issued" name="Tickets sold" fill="#4f8ef7" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="checkedIn" name="Checked in" fill="#ffc72c" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>

                <section className={chartStyles.chartCard}>
                  <h2 className={chartStyles.chartTitle}>Attendance Rate by Event (most recent)</h2>
                  <ResponsiveContainer width="100%" height={Math.max(220, eventStats.length * 32)}>
                    <BarChart data={eventStats} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" tick={AXIS_STYLE} unit="%" domain={[0, 100]} />
                      <YAxis type="category" dataKey="title" tick={{ ...AXIS_STYLE, fontSize: 10 }} width={150} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _n, p) => [`${v}% (${p.payload.checkedIn}/${p.payload.issued})`, 'Attendance rate']} />
                      <Bar dataKey="rate" name="Attendance rate" fill="#34d399" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              </>
            )}
          </div>
        )
      )}

      {tab === 'manage' && (events.length === 0 ? (
        <div className={styles.empty}>
          <p>No events yet.</p>
          {canEdit && <Link href="/portal/events/new" className={styles.createLink}>Create your first event →</Link>}
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={15} strokeWidth={1.75} aria-hidden="true" className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or location…"
              />
            </div>
            <div className={styles.filterTabs} role="group" aria-label="Filter events">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`${styles.filterTab} ${filter === f.key ? styles.filterTabActive : ''}`}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                >
                  {f.label} <span className={styles.filterCount}>{counts[f.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}><p>No events match your search.</p></div>
          ) : (
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <span>Event</span>
                <span>Date</span>
                <span>Tickets</span>
                <span>Status</span>
                {canEdit && <span></span>}
              </div>
              {filtered.map((event) => {
                const isPast = new Date(event.start_date).getTime() < now;
                return (
                  <div key={event.id} className={`${styles.tableRow} ${isPast ? styles.tableRowPast : ''}`}>
                    <div>
                      <div className={styles.eventTitle}>{event.title}</div>
                      {event.location && (
                        <div className={styles.eventLocation}><MapPin size={11} strokeWidth={1.75} aria-hidden="true" /> {event.location}</div>
                      )}
                    </div>
                    <div className={styles.eventDate}>
                      {new Date(event.start_date).toLocaleDateString('en-US', {
                        timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      <span className={styles.checkinSub}>
                        {' '}{new Date(event.start_date).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className={styles.ticketInfo}>
                      {event.requires_ticket ? (
                        <button type="button" className={styles.checkinLink} onClick={() => setCheckinsEventId(event.id)}>
                          <Ticket size={12} strokeWidth={1.75} aria-hidden="true" /> {event.ticketsIssued}
                          {event.max_capacity ? `/${event.max_capacity}` : ''}
                          {event.ticketsIssued > 0 && <span className={styles.checkinSub}> · {event.ticketsCheckedIn} in</span>}
                        </button>
                      ) : (
                        <span className={styles.noTicket}>No ticket</span>
                      )}
                    </div>
                    <div className={styles.statusCol}>
                      <span className={`${styles.badge} ${event.is_published ? styles.published : styles.draft}`}>
                        {event.is_published ? 'Published' : 'Draft'}
                      </span>
                      {event.audience === 'ucsd_only' && (
                        <span className={`${styles.badge} ${styles.ucsdBadge}`}>UCSD Only</span>
                      )}
                    </div>
                    {canEdit && (
                      <div className={styles.rowActions}>
                        <Link href={`/portal/events/${event.id}`} className={styles.checkinLink}>Edit</Link>
                        <Link href={`/portal/events/new?from=${event.id}`} className={styles.checkinLink}>Duplicate</Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ))}

      {checkinsEventId && (
        <EventCheckinsModal eventId={checkinsEventId} onClose={() => setCheckinsEventId(null)} />
      )}
    </div>
  );
}
