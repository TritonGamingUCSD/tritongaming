import type { Metadata } from 'next';
import NextEventTicket from '@/components/NextEventTicket/NextEventTicket';
import { ZineBand, PageHero, BandHeader } from '@/components/ZineBand/ZineBand';
import EventCard from '@/components/EventCard/EventCard';
import EventsCalendar from '@/components/EventsCalendar/EventsCalendar';
import { getUpcomingEvents, getPreviousEvents } from '@/lib/events';
import { getContentBlocks } from '@/lib/content';
import { resolveSections } from '@/lib/pageLayout';
import { Fragment } from 'react';
import styles from './events.module.css';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Upcoming and past Triton Gaming events. Gaming Org at UC San Diego.',
  alternates: { canonical: '/events' },
  openGraph: {
    title: 'Events',
    description: 'Upcoming and past Triton Gaming events. Gaming Org at UC San Diego.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Events',
    description: 'Upcoming and past Triton Gaming events. Gaming Org at UC San Diego.',
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

  // The soonest upcoming event is the one big ticket; the rest of upcoming is a grid on ink;
  // the archive sits on a paper band so the page changes tone once, at the point it changes meaning.
  const [featured, ...restUpcoming] = upcoming;

  const sections: Record<string, React.ReactNode> = {
    upcoming: (
      <>
        {featured && (
          <ZineBand tone="navy" edge={false} label="Next event">
            <BandHeader label={(content.next_label as string) || "Don't miss out"} title={(content.next_title as string) || 'Next up'} />
            <NextEventTicket event={featured} />
          </ZineBand>
        )}
        {restUpcoming.length > 0 && (
          <ZineBand tone="ink" label="Upcoming events">
            <BandHeader label={(content.upcoming_label as string) || 'Coming soon'} title={(content.upcoming_title as string) || 'Also coming up'} />
            <div className={styles.grid}>
              {restUpcoming.map((event) => <EventCard key={event._id} event={event} />)}
            </div>
          </ZineBand>
        )}
      </>
    ),
    calendar: (
      <ZineBand tone="navy" label="Calendar">
        <BandHeader label="Plan ahead" title="Calendar" sub="Every event by day. Add any of them to your own calendar." />
        <EventsCalendar events={[...upcoming, ...previous].map((e) => ({ id: e._id, slug: e.slug, name: e.name, start_date: e.start_date, end_date: e.end_date, location: e.location }))} />
      </ZineBand>
    ),
    past: previous.length > 0 ? (
      <ZineBand tone="deep" label="Past events">
        <BandHeader label={(content.past_label as string) || 'The archive'} title={(content.past_title as string) || 'Past events'} sub="Photos, flyers and memories from everything we've run." />
        <div className={styles.grid}>
          {previous.map((event) => <EventCard key={event._id} event={event} />)}
        </div>
      </ZineBand>
    ) : null,
  };

  return (
    <div className={styles.page}>
      <PageHero label={heroLabel} title={heroTitle} sub={heroSub} />

      {shown.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}

      {shown.length > 0 && upcoming.length === 0 && (
        <ZineBand tone="navy" edge={false} label="No upcoming events">
          <p className={styles.emptyMsg}>{(content.empty as string) || 'Nothing on the calendar right now. Check back soon!'}</p>
        </ZineBand>
      )}
    </div>
  );
}
