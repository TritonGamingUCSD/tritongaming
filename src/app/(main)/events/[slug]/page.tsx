import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Ticket, Camera, Award } from 'lucide-react';
import { getEventBySlugOrId } from '@/lib/events';
import { getAlbumPreview } from '@/lib/googlePhotosAlbum';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import EventSocialEmbeds from '@/components/EventSocialEmbeds/EventSocialEmbeds';
import AddToCalendarButton from '@/components/AddToCalendarButton/AddToCalendarButton';
import { formatEventDateRange, formatEventTimeRange } from '@/lib/timezone';
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
  return formatEventDateRange(startISO, endISO, { weekday: true });
}

function formatTime(startISO: string, endISO: string) {
  return formatEventTimeRange(startISO, endISO);
}

export default async function EventDetailPage({ params }: Params) {
  const { slug } = await params;
  const event = await getEventBySlugOrId(slug);
  if (!event) notFound();

  const isPast = new Date(event.end_date || event.start_date) < new Date();
  const isExternalFlyer = event.flyer_url?.startsWith('http');
  const hasPostEventContent = isPast && (event.photo_album_url || event.post_event_info);
  const albumPreview = isPast && event.photo_album_url ? await getAlbumPreview(event.photo_album_url) : null;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        {event.flyer_url && isExternalFlyer ? (
          <>
            {/* Blurred, cropped copy fills the hero band behind the real
                flyer — same treatment as the event cards, so the flyer
                shows in full (uncropped) instead of getting hard-cut to
                fill a fixed-aspect box. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.flyer_url} alt="" aria-hidden="true" className={styles.heroBackdrop} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.flyer_url} alt={event.full_name} className={styles.heroImg} />
          </>
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
        {event.location && <p className={styles.location}><MapPin size={15} strokeWidth={1.5} aria-hidden="true" /> {event.location}</p>}

        {event.content && <p className={styles.summary}>{event.content}</p>}

        {!isPast && (
          <div className={styles.ctaRow}>
            <a href="/portal/tickets" className={styles.ticketBtn}>
              <Ticket size={18} strokeWidth={1.5} aria-hidden="true" />
              {event.audience === 'ucsd_only'
                ? 'UCSD Students — Get Ticket'
                : event.ticket_price > 0
                ? `Get Ticket — $${event.ticket_price} (free for UCSD)`
                : 'Get Ticket — Free'}
            </a>
            <AddToCalendarButton eventId={event._id} />
          </div>
        )}

        {!isPast && event.points_value > 0 && (
          <p className={styles.pointsNote}><Award size={15} strokeWidth={1.75} aria-hidden="true" /> Check in at this event to earn {event.points_value} reward points</p>
        )}

        {event.details && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Event Details</h2>
            <MarkdownContent>{event.details}</MarkdownContent>
          </section>
        )}

        {event.social_embeds.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Related Posts</h2>
            <EventSocialEmbeds embeds={event.social_embeds} />
          </section>
        )}

        {hasPostEventContent && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>After the Event</h2>
            {event.photo_album_url && (
              albumPreview?.image ? (
                <a href={event.photo_album_url} target="_blank" rel="noopener noreferrer" className={styles.albumCard}>
                  {/* Google's own cover collage for the album — not
                      hosted by us, so a plain <img>, same as the flyer
                      treatment elsewhere on this page. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={albumPreview.image} alt="" className={styles.albumCardImg} />
                  <div className={styles.albumCardOverlay} />
                  <span className={styles.albumCardLabel}>
                    <Camera size={15} strokeWidth={1.5} aria-hidden="true" />
                    {albumPreview.title || 'View Event Photos'}
                  </span>
                </a>
              ) : (
                <a href={event.photo_album_url} target="_blank" rel="noopener noreferrer" className={styles.photoLink}>
                  <Camera size={15} strokeWidth={1.5} aria-hidden="true" /> View Event Photos
                </a>
              )
            )}
            {event.post_event_info && <MarkdownContent>{event.post_event_info}</MarkdownContent>}
          </section>
        )}
      </div>
    </div>
  );
}
