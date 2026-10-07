'use client';

import { useMemo, useState } from 'react';
import { usePortalParams, useLiveParams } from '@/lib/portal/usePortalParams';
import SectionTabs from '@/components/ui/SectionTabs';
import Link from 'next/link';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import EventRowActions from './EventRowActions';
import { Search, Plus, Ticket, MapPin, BarChart3, ListChecks, Award } from 'lucide-react';
import { PACIFIC_TZ, formatEventDateRangeShort, eventDayCount } from '@/lib/core/timezone';
import { isCheckinWindowOpen } from '@/lib/events/checkinWindow';
import type { MonthPoint } from '@/lib/events/monthBuckets';
import type { EventTicketStat } from './getEventsData';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import EventCheckinsModal from './EventCheckinsModal';
import DeleteEventModal from './DeleteEventModal';
import { ButtonLink } from '@/components/ui/Button';
import styles from './events.module.css';
import chartStyles from '../admin/stats/stats.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  location: string | null;
  is_published: boolean;
  requires_ticket: boolean;
  audience: 'public' | 'ucsd_only';
  ticketsIssued: number;
  ticketsCheckedIn: number;
  points_value: number;
  // Admin-facing only (sample year/role, not a real attendee's) — see
  // getEventsData. Null for any event without "Requires AS Form" on, or
  // before a form's been configured at all.
  checkinFormPreviewUrl?: string | null;
}

type StatusFilter = 'all' | 'upcoming' | 'past' | 'draft';
type Tab = 'list' | 'analytics';
const VALID_TABS: Tab[] = ['list', 'analytics'];

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
  canManagePoints: boolean;
  // delete_events (admin-only) — separate from canEdit, which lead+ hold.
  canDelete?: boolean;
  initialTab?: string;
}

// Shared between the standalone /portal/events page and the portal hub's
// Events panel, so the two never drift apart visually. Now a client
// component — search + status filter are pure UI state over data that's
// already fully fetched (all events + their ticket counts come in as
// props), so filtering is instant with no round trip.
export default function EventsSectionContent({ events, eventsPerMonth, ticketsPerMonth, eventStats, canEdit, canManagePoints, canDelete = false }: Props) {
  const { tab: initialTab } = useUrlNav();
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'list');
  const syncUrl = usePortalTabSync('events');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t);
  }
  // Deep-linked from portal search (?q=<event title>) — lands with that event already filtered.
  const searchParams = useLiveParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const setParams = usePortalParams();
  const [filter, setFilter] = useState<StatusFilter>(() => {
    const f = searchParams.get('status');
    return FILTERS.some((x) => x.key === f) ? (f as StatusFilter) : 'all';
  });
  const [checkinsEventId, setCheckinsEventId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);

  const now = Date.now();

  const counts = useMemo(() => ({
    all: events.length,
    upcoming: events.filter((e) => isCheckinWindowOpen(e)).length,
    past: events.filter((e) => !isCheckinWindowOpen(e)).length,
    draft: events.filter((e) => !e.is_published).length,
  }), [events, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (filter === 'upcoming' && !isCheckinWindowOpen(e)) return false;
        if (filter === 'past' && isCheckinWindowOpen(e)) return false;
        if (filter === 'draft' && e.is_published) return false;
        if (q && !e.title.toLowerCase().includes(q) && !(e.location ?? '').toLowerCase().includes(q)) return false;
        return true;
      });
  }, [events, filter, query, now]);

  return (
    <div className={styles.page}>
      <SectionHeader title="Events" sub={canEdit ? 'Create, run and review events.' : 'What’s coming up and what you’ve been to.'}
        actions={canEdit ? <ButtonLink href="/portal/events/new"><Plus size={15} strokeWidth={2} aria-hidden="true" /> Create Event</ButtonLink> : undefined} />

      {canEdit && (
        <SectionTabs
          value={tab}
          onChange={selectTab}
          tabs={[
            { id: 'list', label: 'Events', icon: <ListChecks /> },
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 /> },
          ]}
        />
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

      {tab === 'list' && (events.length === 0 ? (
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
                onChange={(e) => { setQuery(e.target.value); setParams({ q: e.target.value || null }); }}
                placeholder="Search by name or location…"
              />
            </div>
            <SectionTabs
              variant="segmented"
              label="Filter events"
              value={filter}
              onChange={(f) => { setFilter(f); setParams({ status: f === 'all' ? null : f }); }}
              tabs={FILTERS.map((f) => ({ id: f.key, label: f.label, count: counts[f.key] }))}
            />
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
                <span className={styles.actionsHead}>Actions</span>
              </div>
              {filtered.map((event) => {
                // Greyed only once the event has actually ended (same rule as
                // check-in), not as soon as it starts.
                const isPast = !isCheckinWindowOpen(event);
                return (
                  <div key={event.id} className={`${styles.tableRow} ${isPast ? styles.tableRowPast : ''}`}>
                    <div>
                      <div className={styles.eventTitle}>{event.title}</div>
                      {event.location && (
                        <div className={styles.eventLocation}><MapPin size={11} strokeWidth={1.75} aria-hidden="true" /> {event.location}</div>
                      )}
                      {event.points_value > 0 && (
                        <div className={styles.eventPointsBadge}><Award size={11} strokeWidth={1.75} aria-hidden="true" /> {event.points_value} pts</div>
                      )}
                    </div>
                    <div className={styles.eventDate}>
                      {formatEventDateRangeShort(event.start_date, event.end_date)}
                      <span className={styles.checkinSub}>
                        {' '}{new Date(event.start_date).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}
                        {eventDayCount(event.start_date, event.end_date) > 1 && ` · ${eventDayCount(event.start_date, event.end_date)} days`}
                      </span>
                    </div>
                    <div className={styles.ticketInfo}>
                      {event.requires_ticket ? (
                        <button type="button" className={styles.checkinLink} onClick={() => setCheckinsEventId(event.id)}>
                          <Ticket size={12} strokeWidth={1.75} aria-hidden="true" /> {event.ticketsIssued}
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
                    <EventRowActions
                      eventId={event.id}
                      title={event.title}
                      showSummary={event.requires_ticket}
                      canEdit={canEdit}
                      previewUrl={event.checkinFormPreviewUrl}
                      canDelete={canDelete}
                      onDelete={() => setDeleteTarget(event)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      ))}

      {deleteTarget && (
        <DeleteEventModal
          event={{ id: deleteTarget.id, title: deleteTarget.title, ticketsIssued: deleteTarget.ticketsIssued, ticketsCheckedIn: deleteTarget.ticketsCheckedIn }}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {checkinsEventId && (
        <EventCheckinsModal eventId={checkinsEventId} onClose={() => setCheckinsEventId(null)} canManagePoints={canManagePoints} />
      )}
    </div>
  );
}
