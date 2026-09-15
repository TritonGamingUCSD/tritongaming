import Link from 'next/link';
import styles from './events.module.css';

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  is_published: boolean;
  requires_ticket: boolean;
  max_capacity: number | null;
}

// Shared between the standalone /portal/events page and the portal hub's
// Events panel, so the two never drift apart visually.
export default function EventsSectionContent({ events }: { events: EventRow[] }) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Event Management</h1>
        <Link href="/portal/events/new" className={styles.newBtn}>+ Create Event</Link>
      </div>

      {events.length === 0 ? (
        <div className={styles.empty}>
          <p>No events yet.</p>
          <Link href="/portal/events/new" className={styles.createLink}>Create your first event →</Link>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Event</span>
            <span>Date</span>
            <span>Tickets</span>
            <span>Status</span>
            <span></span>
          </div>
          {events.map((event) => (
            <div key={event.id} className={styles.tableRow}>
              <div>
                <div className={styles.eventTitle}>{event.title}</div>
                {event.location && <div className={styles.eventLocation}>{event.location}</div>}
              </div>
              <div className={styles.eventDate}>
                {new Date(event.start_date).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </div>
              <div className={styles.ticketInfo}>
                {event.requires_ticket ? (
                  <Link href={`/portal/events/${event.id}/checkins`} className={styles.checkinLink}>
                    View Check-ins
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
          ))}
        </div>
      )}
    </div>
  );
}
