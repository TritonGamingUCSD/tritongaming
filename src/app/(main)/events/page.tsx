import type { Metadata } from 'next';
import LongEventCard from '@/components/LongEventCard/LongEventCard';
import EventCard from '@/components/EventCard/EventCard';
import { getUpcomingEvents, getPreviousEvents } from '@/lib/events';
import { getContentBlocks } from '@/lib/content';
import { resolveSections } from '@/lib/pageLayout';
import { Fragment } from 'react';
import styles from './events.module.css';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Check out upcoming and past Triton Gaming events at UC San Diego.',
  alternates: { canonical: '/events' },
  openGraph: {
    title: 'Events',
    description: 'Check out upcoming and past Triton Gaming events at UC San Diego.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Events',
    description: 'Check out upcoming and past Triton Gaming events at UC San Diego.',
  },
};

// Served from the CDN cache and refreshed in the background — data comes from
// the cached fetchers in lib/ (revalidated on save), not per-request queries.
export const revalidate = 60;

export default async function EventsPage() {
  const [upcoming, previous, blocks] = await Promise.all([
    getUpcomingEvents(),
    getPreviousEvents(),
    getContentBlocks(['page.events', 'layout.events']),
  ]);
  const content = blocks['page.events'] ?? {};
  const shown = resolveSections('events', blocks['layout.events']?.sections);
  const heroLabel = content.label as string;
  const heroTitle = content.title as string;
  const heroSub = content.subtitle as string;

  // The soonest upcoming event gets the full featured treatment (big flyer,
  // ticket CTA); everything else — the rest of upcoming, and all of past —
  // reads as a scannable grid instead of another wide row identical to it.
  // A page-long stack of uniform full-width rows was the "feels weird" of
  // it; one clear focal point plus a grid reads like an actual events page.
  const [featured, ...restUpcoming] = upcoming;

  const sections: Record<string, React.ReactNode> = {
    upcoming: (
      <>
      {featured && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>{(content.next_label as string) || "DON'T MISS OUT"}</p>
            <h2 className={styles.sectionTitle}>{(content.next_title as string) || 'Next Up'}</h2>
          </div>
          <LongEventCard event={featured} />
        </section>
      )}

      {restUpcoming.length > 0 && (
        <section className={styles.section}>
          {!featured && (
            <div className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>{(content.next_label as string) || "DON'T MISS OUT"}</p>
              <h2 className={styles.sectionTitle}>{(content.upcoming_title as string) || 'Upcoming Events'}</h2>
            </div>
          )}
          <div className={styles.grid}>
            {restUpcoming.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        </section>
      )}


      </>
    ),
    past: (
      <>
      {previous.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>{(content.past_label as string) || 'THE ARCHIVE'}</p>
            <h2 className={styles.sectionTitle}>{(content.past_title as string) || 'Past Events'}</h2>
          </div>
          <div className={`${styles.grid} ${styles.gridPast}`}>
            {previous.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        </section>
      )}


      </>
    ),
  };

  return (
    <div className={styles.page}>
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>{heroLabel}</p>
          <h1 className={styles.heroTitle}>{heroTitle}</h1>
          <p className={styles.heroSub}>{heroSub}</p>
        </div>
      </div>

      {shown.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}

      {shown.length > 0 && upcoming.length === 0 && previous.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyMsg}>{(content.empty as string) || 'No events currently scheduled. Check back soon!'}</p>
        </div>
      )}
    </div>
  );
}
