import type { Metadata } from 'next';
import AlternateTitle from '@/components/AlternateTitle/AlternateTitle';
import LongEventCard from '@/components/LongEventCard/LongEventCard';
import eventsData from '@/data/events.json';
import type { Event } from '@/types';
import styles from './events.module.css';

export const metadata: Metadata = {
  title: 'Events | Triton Gaming',
  description: 'Check out upcoming and past Triton Gaming events at UC San Diego.',
};

export default function EventsPage() {
  const events = eventsData as Event[];
  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.start_date) >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const previous = events
    .filter((e) => new Date(e.start_date) < now)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  return (
    <div className={styles.page}>
      {upcoming.length > 0 && (
        <section className={styles.section}>
          <AlternateTitle bgTitle="Upcoming Events" fgTitle="Upcoming Events" />
          {upcoming.map((event) => (
            <LongEventCard key={event._id} event={event} />
          ))}
        </section>
      )}

      {previous.length > 0 && (
        <section className={styles.section}>
          <AlternateTitle bgTitle="Past Events" fgTitle="Past Events" />
          {previous.map((event) => (
            <LongEventCard key={event._id} event={event} />
          ))}
        </section>
      )}

      {upcoming.length === 0 && previous.length === 0 && (
        <div className={styles.empty}>
          <AlternateTitle bgTitle="Events" fgTitle="Events" />
          <p className={styles.emptyMsg}>No events currently scheduled. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
