'use client';

import { useState } from 'react';
import { usePortalParams, useLiveParams } from '@/lib/portal/usePortalParams';
import SectionTabs from '@/components/ui/SectionTabs';
import Link from '@/components/portal/NoPrefetchLink';
import EChart from '@/components/charts/EChart';
import ChartCard from '@/components/charts/ChartCard';
import { areaLine, funnel, groupedBars, rankedBars } from '@/components/charts/chartOptions';
import EventRowActions from './EventRowActions';
import { Search, Plus, Ticket, MapPin, BarChart3, ListChecks, Award, Mail } from 'lucide-react';
import { formatEventDateRangeShort, formatEventTimeRange, eventDayCount } from '@/lib/core/timezone';
import { isCheckinWindowOpen } from '@/lib/events/checkinWindow';
import { monthLabels, type MonthPoint } from '@/lib/events/monthBuckets';
import type { EventTicketStat } from './getEventsData';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import EventCheckinsPage from './EventCheckinsPage';
import EventEmailsTab from './EventEmailsTab';
import EventStatsTable from './EventStatsTable';
import { useAddressState, wordCodec } from '@/lib/portal/usePageState';
import DeleteEventModal from './DeleteEventModal';
import { ButtonLink } from '@/components/ui/Button';
import PosterArt from '../tickets/PosterArt';
import wall from './eventWall.module.css';
import styles from './events.module.css';
import chartStyles from '@/components/charts/charts.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

interface EventRow {
  id: string;
  slug?: string | null;
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
  poster?: string | null;
  accent?: string | null;
}

type StatusFilter = 'all' | 'upcoming' | 'past' | 'draft';
type Tab = 'list' | 'analytics' | 'emails';
const VALID_TABS: Tab[] = ['list', 'analytics', 'emails'];

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'draft', label: 'Drafts' },
];

interface Props {
  events: EventRow[];
  analytics: {
    heldPerMonth: MonthPoint[];
    ticketsPerMonth: MonthPoint[];
    checkinsPerMonth: MonthPoint[];
    eventStats: EventTicketStat[];
    people: { ticketed: number; came: number; returned: number };
  };
  canEdit: boolean;
  canManagePoints: boolean;
  // delete_events (admin-only) — separate from canEdit, which lead+ hold.
  canDelete?: boolean;
  // write_newsletter / send_newsletter: the Emails tab (start an announcement, update or reminder about an event in the Newsletter).
  canEmail?: boolean;
  initialTab?: string;
}

// Shared between the standalone /portal/events page and the portal hub's
// Events panel, so the two never drift apart visually. Now a client
// component — search + status filter are pure UI state over data that's
// already fully fetched (all events + their ticket counts come in as
// props), so filtering is instant with no round trip.
export default function EventsSectionContent({ events, analytics, canEdit, canManagePoints, canDelete = false, canEmail = false }: Props) {
  const { heldPerMonth, ticketsPerMonth, checkinsPerMonth, eventStats, people } = analytics;
  const { tab: initialTab, subtab: initialSub } = useUrlNav();
  // The check-ins page of one event (/portal/events/check-ins/<event>). Held here, like the tab, because changing the address bar alone does not redraw the page.
  const [checkinsKey, setCheckinsKey] = useState<string | null>(initialTab === 'check-ins' && initialSub ? initialSub : null);
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'list');
  const syncUrl = usePortalTabSync('events');
  // Analytics shows charts or the table of every event's numbers (in the address, so a link opens the right one).
  const [view, setView] = useAddressState('view', wordCodec(['charts', 'table'] as const, 'charts'));
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
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);

  const counts = {
    all: events.length,
    upcoming: events.filter((e) => isCheckinWindowOpen(e)).length,
    past: events.filter((e) => !isCheckinWindowOpen(e)).length,
    draft: events.filter((e) => !e.is_published).length,
  };

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (filter === 'upcoming' && !isCheckinWindowOpen(e)) return false;
      if (filter === 'past' && isCheckinWindowOpen(e)) return false;
      if (filter === 'draft' && e.is_published) return false;
      if (q && !e.title.toLowerCase().includes(q) && !(e.location ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  })();

  if (checkinsKey)
    return (
      <div className={styles.page}>
        <EventCheckinsPage
          eventKey={checkinsKey}
          canManagePoints={canManagePoints}
          onBack={() => {
            setCheckinsKey(null);
            setTab('list');
            syncUrl('list');
          }}
        />
      </div>
    );

  return (
    <div className={styles.page} data-wide>
      <SectionHeader
        title="Events"
        sub={canEdit ? undefined : 'What’s coming up and what you’ve been to.'}
        actions={
          canEdit && tab === 'list' ? (
            <ButtonLink href="/portal/events/new">
              <Plus size={15} strokeWidth={2} aria-hidden="true" /> Create Event
            </ButtonLink>
          ) : undefined
        }
      />

      {(canEdit || canEmail) && (
        <SectionTabs
          top
          value={tab}
          onChange={selectTab}
          tabs={[
            { id: 'list', label: 'Events', icon: <ListChecks /> },
            ...(canEdit ? [{ id: 'analytics' as const, label: 'Analytics', icon: <BarChart3 /> }] : []),
            ...(canEmail ? [{ id: 'emails' as const, label: 'Emails', icon: <Mail /> }] : []),
          ]}
        />
      )}

      {tab === 'emails' && canEmail && <EventEmailsTab />}

      {tab === 'analytics' && canEdit && (
        <SectionTabs<'charts' | 'table'>
          variant="segmented"
          label="Analytics view"
          value={view}
          onChange={setView}
          tabs={[
            { id: 'charts', label: 'Charts' },
            { id: 'table', label: 'Table' },
          ]}
        />
      )}
      {tab === 'analytics' && canEdit && view === 'table' && <EventStatsTable />}

      {tab === 'analytics' &&
        canEdit &&
        view === 'charts' &&
        (heldPerMonth.length === 0 && ticketsPerMonth.length === 0 && eventStats.length === 0 ? (
          <div className={styles.empty}>
            <p>Not enough data yet to chart trends.</p>
          </div>
        ) : (
          <EventCharts heldPerMonth={heldPerMonth} ticketsPerMonth={ticketsPerMonth} checkinsPerMonth={checkinsPerMonth} eventStats={eventStats} people={people} />
        ))}

      {tab === 'list' &&
        (events.length === 0 ? (
          <div className={styles.empty}>
            <p>No events yet.</p>
            {canEdit && (
              <Link href="/portal/events/new" className={styles.createLink}>
                Create your first event →
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <div className={styles.searchWrap}>
                <Search size={15} strokeWidth={1.75} aria-hidden="true" className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setParams({ q: e.target.value || null });
                  }}
                  placeholder="Search by name or location…"
                />
              </div>
              <SectionTabs
                variant="segmented"
                label="Filter events"
                value={filter}
                onChange={(f) => {
                  setFilter(f);
                  setParams({ status: f === 'all' ? null : f });
                }}
                tabs={FILTERS.map((f) => ({ id: f.key, label: f.label, count: counts[f.key] }))}
              />
            </div>

            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <p>No events match your search.</p>
              </div>
            ) : (
              <div className={wall.wall}>
                {filtered.map((event, i) => {
                  const now = Date.now();
                  const start = new Date(event.start_date).getTime();
                  const isPast = !isCheckinWindowOpen(event);
                  const live = !isPast && start <= now;
                  const soon = !isPast && !live && start - now < 7 * 86400e3;
                  const sticker = !event.is_published
                    ? ['Draft', wall.sDraft]
                    : live
                      ? ['Live now', wall.sLive]
                      : soon
                        ? ['Soon', wall.sSoon]
                        : isPast
                          ? ['Done', wall.sDone]
                          : ['Upcoming', wall.sUp];
                  const pct = event.ticketsIssued ? Math.round((event.ticketsCheckedIn / event.ticketsIssued) * 100) : 0;
                  return (
                    <article
                      key={event.id}
                      className={`${wall.card} ${isPast ? wall.past : ''}`}
                      style={{ ['--ev' as string]: event.accent || 'var(--yellow)', ['--tilt' as string]: `${((i * 5) % 7) - 3}deg` }}
                    >
                      <span className={wall.tape} aria-hidden="true" />
                      <div className={wall.posterBox}>
                        <PosterArt poster={event.poster} accent={event.accent} title={event.title} className={wall.poster} />
                        <span className={`${wall.sticker} ${sticker[1]}`}>{sticker[0]}</span>
                        {event.audience === 'ucsd_only' && <span className={`${wall.sticker} ${wall.sUcsd}`}>UCSD only</span>}
                      </div>
                      <div className={wall.body}>
                        <h3 className={wall.title}>{event.title}</h3>
                        <p className={wall.when}>
                          {formatEventDateRangeShort(event.start_date, event.end_date)} · {formatEventTimeRange(event.start_date, event.end_date)}
                          {eventDayCount(event.start_date, event.end_date) > 1 && ` · ${eventDayCount(event.start_date, event.end_date)} days`}
                        </p>
                        {event.location && (
                          <p className={wall.where}>
                            <MapPin size={12} strokeWidth={1.75} aria-hidden="true" /> {event.location}
                          </p>
                        )}
                        {event.points_value > 0 && (
                          <span className={wall.pts}>
                            <Award size={11} strokeWidth={1.75} aria-hidden="true" /> {event.points_value} pts
                          </span>
                        )}
                      </div>
                      {event.requires_ticket ? (
                        <button
                          type="button"
                          className={wall.meter}
                          onClick={() => {
                            const key = event.slug ?? event.id;
                            setCheckinsKey(key);
                            syncUrl('check-ins', key);
                          }}
                          aria-label={`${event.ticketsCheckedIn} of ${event.ticketsIssued} checked in. Open the check-ins.`}
                        >
                          <span className={wall.meterTop}>
                            <Ticket size={12} strokeWidth={1.75} aria-hidden="true" /> {event.ticketsIssued} ticket{event.ticketsIssued === 1 ? '' : 's'}
                            {event.ticketsIssued > 0 && <b>{event.ticketsCheckedIn} in</b>}
                          </span>
                          <span className={wall.track}>
                            <span style={{ width: `${pct}%` }} />
                          </span>
                        </button>
                      ) : (
                        <span className={wall.noTicket}>No ticket needed</span>
                      )}
                      <div className={wall.foot}>
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
                    </article>
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
    </div>
  );
}

// The Analytics tab: what turned out to matter for running events. How many events happened, how sign-ups turn into people in the room, which events drew the most, whether show-up is getting better, and who comes back.
function EventCharts({ heldPerMonth, ticketsPerMonth, checkinsPerMonth, eventStats, people }: Props['analytics']) {
  const monthKeys = [...new Set([...ticketsPerMonth, ...checkinsPerMonth, ...heldPerMonth].map((p) => p.key))].sort();
  const names = monthLabels(monthKeys);
  const months = monthKeys.map((k) => names.get(k) ?? k);
  const at = (list: MonthPoint[], m: string) => list.find((p) => p.key === monthKeys[months.indexOf(m)])?.count ?? 0;
  const biggest = [...eventStats].sort((a, b) => b.checkedIn - a.checkedIn).slice(0, 12);
  const rateNow = eventStats.length ? eventStats[eventStats.length - 1].rate : 0;
  const rateAvg = eventStats.length ? Math.round(eventStats.reduce((n, e) => n + e.rate, 0) / eventStats.length) : 0;
  return (
    <div className={chartStyles.grid}>
      {heldPerMonth.length > 0 && (
        <ChartCard
          title="Events Held"
          sub="Events that happened, by the month they took place."
          table={{ head: ['Month', 'Events'], rows: heldPerMonth.map((p) => [p.month, p.count]) }}
        >
          <EChart
            label="Events held per month"
            build={(t) => groupedBars(t, { x: heldPerMonth.map((p) => p.month), series: [{ name: 'Events', data: heldPerMonth.map((p) => p.count) }] })}
          />
        </ChartCard>
      )}
      {months.length > 0 && (
        <ChartCard
          title="Sign-Ups And Check-Ins"
          sub="Tickets taken and people checked in, month by month."
          table={{ head: ['Month', 'Tickets', 'Check-ins'], rows: months.map((m) => [m, at(ticketsPerMonth, m), at(checkinsPerMonth, m)]) }}
        >
          <EChart
            label="Tickets and check-ins each month"
            build={(t) =>
              groupedBars(t, {
                x: months,
                series: [
                  { name: 'Tickets', data: months.map((m) => at(ticketsPerMonth, m)) },
                  { name: 'Check-ins', data: months.map((m) => at(checkinsPerMonth, m)) },
                ],
              })
            }
          />
        </ChartCard>
      )}
      {biggest.length > 0 && (
        <ChartCard
          title="Biggest Turnouts"
          sub="People checked in, for the twelve events that drew the most."
          table={{ head: ['Event', 'Tickets', 'Checked in', 'Showed up'], rows: biggest.map((e) => [e.title, e.issued, e.checkedIn, `${e.rate}%`]) }}
        >
          <EChart
            label="People checked in per event"
            height={Math.max(200, biggest.length * 32 + 20)}
            build={(t) => rankedBars(t, { labels: biggest.map((e) => e.title), values: biggest.map((e) => e.checkedIn), color: t.series[0] })}
          />
        </ChartCard>
      )}
      {eventStats.length > 1 && (
        <ChartCard
          title="Show-Up Rate Over Time"
          sub={`Of the people with a ticket, how many came. Latest event ${rateNow}%, average ${rateAvg}%.`}
          table={{ head: ['Event', 'Showed up'], rows: eventStats.map((e) => [e.title, `${e.rate}%`]) }}
        >
          <EChart
            label="Show-up rate for each event, oldest to newest"
            build={(t) => areaLine(t, { x: eventStats.map((e) => e.title), y: eventStats.map((e) => e.rate), name: 'Showed up (%)', color: t.series[2], max: 100 })}
          />
        </ChartCard>
      )}
      {people.came > 0 && (
        <ChartCard
          title="Who Comes Back"
          sub={`${people.returned.toLocaleString()} of ${people.came.toLocaleString()} people who came have been to more than one event.`}
          table={{
            head: ['Step', 'People'],
            rows: [
              ['Had a ticket', people.ticketed],
              ['Came to an event', people.came],
              ['Came to 2 or more', people.returned],
            ],
          }}
        >
          <EChart
            label="People who had a ticket, came, and came back"
            height={240}
            build={(t) =>
              funnel(t, {
                steps: [
                  { name: 'Had a ticket', value: people.ticketed },
                  { name: 'Came', value: people.came },
                  { name: 'Came back', value: people.returned },
                ],
              })
            }
          />
        </ChartCard>
      )}
    </div>
  );
}
