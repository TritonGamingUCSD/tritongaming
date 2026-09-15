import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventBySlugOrId } from '@/lib/events';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import styles from './event-detail.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlugOrId(slug);
  if (!event) return { title: 'Event | Triton Gaming' };
  return {
    title: `${event.full_name} | Triton Gaming`,
    description: event.content || event.details || undefined,
  };
}

function formatDateRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : null;
  if (!end || start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const s = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const e = end.toLocaleDateString('en-US', { month: sameMonth ? undefined : 'long', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

function formatTime(startISO: string, endISO: string) {
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const start = fmt(new Date(startISO));
  if (!endISO) return start;
  return `${start} – ${fmt(new Date(endISO))}`;
}

export default async function EventDetailPage({ params }: Params) {
  const { slug } = await params;
  const event = await getEventBySlugOrId(slug);
  if (!event) notFound();

  const isPast = new Date(event.end_date || event.start_date) < new Date();
  const isExternalFlyer = event.flyer_url?.startsWith('http');
  const hasPostEventContent = isPast && (event.photo_album_url || event.post_event_info);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        {event.flyer_url ? (
          isExternalFlyer ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.flyer_url} alt={event.full_name} className={styles.heroImg} />
          ) : (
            <Image src="/images/what_is_triton_gaming_justinlu.jpg" alt={event.full_name} fill sizes="100vw" style={{ objectFit: 'cover' }} />
          )
        ) : (
          <Image src="/images/what_is_triton_gaming_justinlu.jpg" alt={event.full_name} fill sizes="100vw" style={{ objectFit: 'cover' }} />
        )}
        <div className={styles.heroOverlay} />
      </div>

      <div className={styles.body}>
        <Link href="/events" className={styles.back}>← All Events</Link>

        {isPast && <span className={styles.pastBadge}>Past Event</span>}

        <h1 className={styles.title}>{event.full_name}</h1>

        <p className={styles.meta}>
          {formatDateRange(event.start_date, event.end_date)}
          <span className={styles.hash}>#</span>
          {formatTime(event.start_date, event.end_date)}
        </p>
        {event.location && <p className={styles.location}>📍 {event.location}</p>}

        {event.content && <p className={styles.summary}>{event.content}</p>}

        {!isPast && (
          <a href="/portal/tickets" className={styles.ticketBtn}>
            🎟️{' '}
            {event.audience === 'ucsd_only'
              ? 'UCSD Students — Get Ticket'
              : event.ticket_price > 0
              ? `Get Ticket — $${event.ticket_price} (free for UCSD)`
              : 'Get Ticket — Free'}
          </a>
        )}

        {event.details && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Event Details</h2>
            <MarkdownContent>{event.details}</MarkdownContent>
          </section>
        )}

        {hasPostEventContent && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>After the Event</h2>
            {event.photo_album_url && (
              <a href={event.photo_album_url} target="_blank" rel="noopener noreferrer" className={styles.photoLink}>
                📸 View Event Photos
              </a>
            )}
            {event.post_event_info && <MarkdownContent>{event.post_event_info}</MarkdownContent>}
          </section>
        )}
      </div>
    </div>
  );
}
