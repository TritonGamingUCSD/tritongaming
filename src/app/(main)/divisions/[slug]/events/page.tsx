import { notFound } from 'next/navigation';
import { getDivisionBySlug, getDivisions } from '@/lib/members/divisions';
import { ZineBand, BandHeader } from '@/components/ZineBand/ZineBand';
import DivisionSubHero from '../DivisionSubHero';
import EventCard from '@/components/EventCard/EventCard';
import { getDivisionEvents } from '@/lib/events/events';
import styles from '../division.module.css';

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getDivisions()).map((d) => ({ slug: d.slug }));
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const division = await getDivisionBySlug(slug);
  if (!division) return { title: 'Division' };
  return {
    title: `Events · ${division.name}`,
    description: `Events of ${division.name}, a Triton Gaming division. Gaming Org at UC San Diego.`,
    alternates: { canonical: `/${slug}/events` },
  };
}

export default async function DivisionEventsPage({ params }: Params) {
  const { slug } = await params;
  const division = await getDivisionBySlug(slug);
  if (!division) notFound();
  const { upcoming, previous } = await getDivisionEvents(division.id);
  return (
    <div className={styles.page}>
      <DivisionSubHero division={division} title="Events" />
      {upcoming.length > 0 && (
        <ZineBand tone="ink" edge={false} label="Upcoming events">
          <BandHeader label="Coming soon" title="Upcoming" />
          <div className={styles.eventGrid}>
            {upcoming.map((e) => (
              <EventCard key={e._id} event={e} />
            ))}
          </div>
        </ZineBand>
      )}
      {previous.length > 0 && (
        <ZineBand tone="deep" edge={upcoming.length > 0} label="Past events">
          <BandHeader label="The archive" title="Past events" />
          <div className={styles.eventGrid}>
            {previous.map((e) => (
              <EventCard key={e._id} event={e} />
            ))}
          </div>
        </ZineBand>
      )}
      {upcoming.length === 0 && previous.length === 0 && (
        <ZineBand tone="ink" edge={false} label="Events">
          <p className={styles.emptyNote}>{division.name} has no public events yet. Check back soon!</p>
        </ZineBand>
      )}
    </div>
  );
}
