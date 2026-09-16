import type { Metadata } from 'next';
import LongEventCard from '@/components/LongEventCard/LongEventCard';
import EventCard from '@/components/EventCard/EventCard';
import { getUpcomingEvents, getPreviousEvents } from '@/lib/events';
import styles from './events.module.css';

export const metadata: Metadata = {
  title: 'Events | Triton Gaming',
  description: 'Check out upcoming and past Triton Gaming events at UC San Diego.',
};

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const [upcoming, previous] = await Promise.all([
    getUpcomingEvents(),
    getPreviousEvents(),
  ]);

  // The soonest upcoming event gets the full featured treatment (big flyer,
  // ticket CTA); everything else — the rest of upcoming, and all of past —
  // reads as a scannable grid instead of another wide row identical to it.
  // A page-long stack of uniform full-width rows was the "feels weird" of
  // it; one clear focal point plus a grid reads like an actual events page.
  const [featured, ...restUpcoming] = upcoming;

  return (
    <div className={styles.page}>
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>WHAT'S HAPPENING</p>
          <h1 className={styles.heroTitle}>Events</h1>
          <p className={styles.heroSub}>
            LANs, tournaments, GBMs, and socials — everything Triton Gaming has run or has coming up.
          </p>
        </div>
      </div>

      {featured && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>DON'T MISS OUT</p>
            <h2 className={styles.sectionTitle}>Next Up</h2>
          </div>
          <LongEventCard event={featured} />
        </section>
      )}

      {restUpcoming.length > 0 && (
        <section className={styles.section}>
          {!featured && (
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>DON'T MISS OUT</p>
              <h2 className={styles.sectionTitle}>Upcoming Events</h2>
            </div>
          )}
          <div className={styles.grid}>
            {restUpcoming.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        </section>
      )}

      {previous.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>THE ARCHIVE</p>
            <h2 className={styles.sectionTitle}>Past Events</h2>
          </div>
          <div className={`${styles.grid} ${styles.gridPast}`}>
            {previous.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length === 0 && previous.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyMsg}>No events currently scheduled. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
