import Link from '@/components/portal/NoPrefetchLink';
import { MapPin, ChevronRight, CalendarDays } from 'lucide-react';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import styles from './dashboard.module.css';
import type TicketsClient from './tickets/TicketsClient';

type UpcomingEvent = Parameters<typeof TicketsClient>[0]['upcomingEvents'][number];

// Fills the Hub home view with something to actually look at — the grid of
// section cards that used to live here is gone now (see PortalHub, which
// hands mobile nav off to the bottom tab bar instead), so with no upcoming
// ticket the home screen was just a greeting and a search bar over a lot of
// empty space. Reuses the exact same upcomingEvents list TicketsClient
// already gets (already filtered to exclude anything the viewer holds a
// ticket to — see page.tsx), capped to 3 so this stays a preview, not a
// second copy of the Tickets tab's own full list. Tapping any row goes to
// Tickets, where the real "Get Ticket"/"Buy Ticket" flow already lives —
// this is deliberately read-only, not a duplicate registration UI.
export default function UpcomingEventsPreview({ events }: { events: UpcomingEvent[] }) {
  if (events.length === 0) return null;
  const preview = events.slice(0, 3);

  return (
    <section className={styles.upcomingPreview}>
      <div className={styles.upcomingPreviewHeader}>
        <span className={styles.upcomingPreviewLabel}>
          <CalendarDays size={13} strokeWidth={1.75} aria-hidden="true" /> Upcoming Events
        </span>
        <Link href="/portal/tickets" className={styles.viewAllTickets}>See all →</Link>
      </div>
      <div className={styles.upcomingPreviewList}>
        {preview.map((event) => (
          <Link key={event.id} href="/portal/tickets" className={styles.upcomingPreviewRow}>
            <div className={styles.eventDateBlockSmall}>
              <span>{new Date(event.start_date).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short' })}</span>
              <span>{new Date(event.start_date).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, day: 'numeric' })}</span>
            </div>
            <div className={styles.upcomingPreviewBody}>
              <div className={styles.upcomingPreviewTitle}>{event.title}</div>
              {event.location && (
                <div className={styles.upcomingPreviewLoc}><MapPin size={11} strokeWidth={1.75} aria-hidden="true" /> {event.location}</div>
              )}
            </div>
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" className={styles.upcomingPreviewChevron} />
          </Link>
        ))}
      </div>
    </section>
  );
}
