'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Ticket, MapPin } from 'lucide-react';
import styles from './events.module.css';

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  is_published: boolean;
  requires_ticket: boolean;
  max_capacity: number | null;
  ticketsIssued: number;
  ticketsCheckedIn: number;
}

type StatusFilter = 'all' | 'upcoming' | 'past' | 'draft';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'draft', label: 'Drafts' },
];

// Shared between the standalone /portal/events page and the portal hub's
// Events panel, so the two never drift apart visually. Now a client
// component — search + status filter are pure UI state over data that's
// already fully fetched (all events + their ticket counts come in as
// props), so filtering is instant with no round trip.
export default function EventsSectionContent({ events }: { events: EventRow[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

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
        <h1 className={styles.title}>Event Management</h1>
        <Link href="/portal/events/new" className={styles.newBtn}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" /> Create Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className={styles.empty}>
          <p>No events yet.</p>
          <Link href="/portal/events/new" className={styles.createLink}>Create your first event →</Link>
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
                <span></span>
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
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </div>
                    <div className={styles.ticketInfo}>
                      {event.requires_ticket ? (
                        <Link href={`/portal/events/${event.id}/checkins`} className={styles.checkinLink}>
                          <Ticket size={12} strokeWidth={1.75} aria-hidden="true" /> {event.ticketsIssued}
                          {event.max_capacity ? `/${event.max_capacity}` : ''}
                          {event.ticketsIssued > 0 && <span className={styles.checkinSub}> · {event.ticketsCheckedIn} in</span>}
                        </Link>
                      ) : (
                        <span className={styles.noTicket}>No ticket</span>
                      )}
                    </div>
                    <div>
                      <span className={`${styles.badge} ${event.is_published ? styles.published : styles.draft}`}>
                        {event.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div>
                      <Link href={`/portal/events/${event.id}`} className={styles.checkinLink}>Edit</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
