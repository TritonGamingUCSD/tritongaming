import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Ticket, Camera, Award, CalendarDays, Users, Navigation, ExternalLink } from 'lucide-react';
import { getEventBySlugOrId, getGoingCount, getAllEvents } from '@/lib/events';
import { isCheckinWindowOpen } from '@/lib/checkinWindow';
import { getAlbumPreview } from '@/lib/googlePhotosAlbum';
import { markdownToDescription } from '@/lib/markdown';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import EventSocialEmbeds from '@/components/EventSocialEmbeds/EventSocialEmbeds';
import AddToCalendarButton from '@/components/AddToCalendarButton/AddToCalendarButton';
import { formatEventDateRange, formatEventTimeRange, eventDayCount } from '@/lib/timezone';
import styles from './event-detail.module.css';

// Cached page (data comes from the tagged caches in lib/events.ts, refreshed when an event is saved).
export const revalidate = 60;

// Built at deploy time for existing events; a new event renders on first visit, then is cached.
export async function generateStaticParams() {
  return (await getAllEvents(100)).map((e) => ({ slug: e.slug || e._id }));
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlugOrId(slug);
  if (!event) return { title: 'Event' };

  const title = event.full_name;
  // `content` (Short Summary) is already plain text; `details` (Event
  // Details) is Markdown, so it needs stripping before it's safe in a meta
  // description — same reasoning as the division page's own fallback.
  const description = event.content?.trim()
    ? event.content
    : event.details?.trim()
    ? markdownToDescription(event.details)
    : `Join Triton Gaming for ${event.full_name}${event.location ? ` at ${event.location}` : ''}.`;

  return {
    title,
    description,
    alternates: { canonical: `/events/${event.slug || event._id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      ...(event.flyer_url ? { images: [{ url: event.flyer_url }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(event.flyer_url ? { images: [event.flyer_url] } : {}),
    },
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

  // Same rule as check-in/ticketing (see lib/checkinWindow): an event isn't
  // "past" — and its Get Ticket button stays — until its end time (or the
  // same-day grace when it has none), not the moment it starts.
  const isPast = !isCheckinWindowOpen(event);
  const isExternalFlyer = event.flyer_url?.startsWith('http');
  const goingCount = await getGoingCount(event._id);
  const dayCount = eventDayCount(event.start_date, event.end_date || null);
  const venueAddress = event.venue_address.trim();
  const mapSrc = venueAddress ? `https://www.google.com/maps?q=${encodeURIComponent(venueAddress)}&output=embed` : null;
  const mapsLink = venueAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueAddress)}` : null;
  const directionsLink = venueAddress ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueAddress)}` : null;
  const hasPostEventContent = isPast && (event.photo_albums.length > 0 || event.post_event_info);
  // Fetched in display order, in parallel — each is an independent network
  // call to a different Google Photos page, so awaiting them one at a time
  // would serialize what's otherwise an embarrassingly parallel fetch.
  const albumPreviews = isPast
    ? await Promise.all(event.photo_albums.map((a) => getAlbumPreview(a.url)))
    : [];

  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.full_name,
    startDate: event.start_date,
    ...(event.end_date ? { endDate: event.end_date } : {}),
    eventAttendanceMode: event.url?.includes('discord') || !event.location
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    ...(event.location ? { location: { '@type': 'Place', name: event.location } } : {}),
    ...(event.flyer_url ? { image: [event.flyer_url] } : {}),
    description: event.content || undefined,
    organizer: { '@type': 'Organization', name: 'Triton Gaming', url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000' },
  };

  return (
    <div className={styles.page}>
      {/* eslint-disable-next-line react/no-danger -- server-built object from our own event data, not user input rendered raw */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }} />
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

        {event.content && <p className={styles.summary}>{event.content}</p>}

        {!isPast && (
          <div className={styles.ctaRow}>
            <a href="/portal?section=tickets" className={styles.ticketBtn}>
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

        <div className={styles.facts}>
          <div className={styles.fact}>
            <span className={styles.factIcon}><CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" /></span>
            <div>
              <div className={styles.factLabel}>When</div>
              <div className={styles.factValue}>{formatEventDateRange(event.start_date, event.end_date || null)}</div>
              <div className={styles.factSub}>{formatEventTimeRange(event.start_date, event.end_date || null)}{dayCount > 1 && ` · ${dayCount} days`}</div>
            </div>
          </div>
          {event.location && (
            <div className={styles.fact}>
              <span className={styles.factIcon}><MapPin size={18} strokeWidth={1.75} aria-hidden="true" /></span>
              <div>
                <div className={styles.factLabel}>Where</div>
                <div className={styles.factValue}>{event.location}</div>
                {venueAddress && <div className={styles.factSub}>{venueAddress}</div>}
              </div>
            </div>
          )}
          {goingCount > 0 && (
            <div className={styles.fact}>
              <span className={styles.factIcon}><Users size={18} strokeWidth={1.75} aria-hidden="true" /></span>
              <div>
                <div className={styles.factLabel}>{isPast ? 'Registered' : 'Going'}</div>
                <div className={styles.factValue}>{goingCount.toLocaleString()}</div>
                <div className={styles.factSub}>{isPast ? 'people had a ticket' : goingCount === 1 ? 'person is going' : 'people are going'}</div>
              </div>
            </div>
          )}
        </div>

        {event.details && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Event Details</h2>
            <MarkdownContent>{event.details}</MarkdownContent>
          </section>
        )}

        {event.schedule.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Schedule</h2>
            <ol className={styles.timeline}>
              {event.schedule.map((item, i) => (
                <li key={i} className={styles.timelineItem}>
                  <span className={styles.timelineTime}>{item.time}</span>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <div className={styles.timelineBody}>
                    <div className={styles.timelineTitle}>{item.title}</div>
                    {item.description && <div className={styles.timelineDesc}>{item.description}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {mapSrc && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Venue</h2>
            <div className={styles.venue}>
              <iframe
                className={styles.map}
                src={mapSrc}
                title={`Map of ${venueAddress}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <div className={styles.venueInfo}>
                <div className={styles.venueAddress}><MapPin size={16} strokeWidth={1.75} aria-hidden="true" /> {venueAddress}</div>
                {event.venue_notes && <p className={styles.venueNotes}>{event.venue_notes}</p>}
                <div className={styles.venueLinks}>
                  <a href={directionsLink!} target="_blank" rel="noopener noreferrer" className={styles.venueBtn}><Navigation size={14} strokeWidth={1.75} aria-hidden="true" /> Get directions</a>
                  <a href={mapsLink!} target="_blank" rel="noopener noreferrer" className={styles.venueBtn}><ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" /> Open in Maps</a>
                </div>
              </div>
            </div>
          </section>
        )}

        {event.sponsors.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sponsors</h2>
            <div className={styles.sponsors}>
              {event.sponsors.map((sp, i) => {
                const inner = (
                  <>
                    {sp.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sp.logo_url} alt={sp.name} className={styles.sponsorLogo} loading="lazy" />
                    ) : (
                      <span className={styles.sponsorName}>{sp.name}</span>
                    )}
                  </>
                );
                return sp.url ? (
                  <a key={i} href={sp.url} target="_blank" rel="noopener noreferrer nofollow" className={styles.sponsor} aria-label={sp.name}>{inner}</a>
                ) : (
                  <div key={i} className={styles.sponsor} aria-label={sp.name}>{inner}</div>
                );
              })}
            </div>
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
            {event.photo_albums.length > 0 && (
              <div className={styles.albumGrid}>
                {event.photo_albums.map((album, i) => {
                  const preview = albumPreviews[i];
                  return preview?.image ? (
                    <a key={`${album.url}-${i}`} href={album.url} target="_blank" rel="noopener noreferrer" className={styles.albumCard}>
                      {/* Google's own cover collage for the album — not
                          hosted by us, so a plain <img>, same as the flyer
                          treatment elsewhere on this page. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.image} alt={`Cover photo for ${album.title}`} className={styles.albumCardImg} />
                      <div className={styles.albumCardOverlay} />
                      <span className={styles.albumCardLabel}>
                        <Camera size={15} strokeWidth={1.5} aria-hidden="true" />
                        {album.title}
                      </span>
                    </a>
                  ) : (
                    <a key={`${album.url}-${i}`} href={album.url} target="_blank" rel="noopener noreferrer" className={styles.photoLink}>
                      <Camera size={15} strokeWidth={1.5} aria-hidden="true" /> {album.title}
                    </a>
                  );
                })}
              </div>
            )}
            {event.post_event_info && <MarkdownContent>{event.post_event_info}</MarkdownContent>}
          </section>
        )}
      </div>
    </div>
  );
}
