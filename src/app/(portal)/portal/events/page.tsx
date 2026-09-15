import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import styles from './events.module.css';

export const metadata = { title: 'Event Management' };
export const dynamic = 'force-dynamic';

export default async function EventsManagementPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_events')) redirect('/portal');

  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date, location, is_published, requires_ticket, max_capacity')
    .order('start_date', { ascending: false })
    .limit(50);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Event Management</h1>
        <Link href="/portal/events/new" className={styles.newBtn}>+ Create Event</Link>
      </div>

      {!events || events.length === 0 ? (
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
                  <Link href={`/portal/checkin?event=${event.id}`} className={styles.checkinLink}>
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
