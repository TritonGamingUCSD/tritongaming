import BodyStickers from '@/components/BodyStickers/BodyStickers';
import ScrollShield from '@/components/ScrollShield/ScrollShield';
import { eventCardInputs, ogVersion } from '@/lib/site/ogRoutes';
import HeroStickers from '@/components/HeroStickers/HeroStickers';
import PosterGallery from '@/components/PosterGallery/PosterGallery';
import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Ticket, Camera, Award, CalendarDays, Users, Navigation, ExternalLink } from 'lucide-react';
import { getEventBySlugOrId, getGoingCount, getAllEvents } from '@/lib/events/events';
import { isCheckinWindowOpen } from '@/lib/events/checkinWindow';
import { getAlbumPreview } from '@/lib/storage/googlePhotosAlbum';
import { markdownToDescription } from '@/lib/docs/markdown';
import { clampDescription } from '@/lib/site/ogCard';
import PageBlocks from '@/components/PageBlocks/PageBlocks';
import LogoPlate from '@/components/LogoPlate/LogoPlate';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import EventSocialEmbeds from '@/components/EventSocialEmbeds/EventSocialEmbeds';
import AddToCalendarButton, { AddToGoogleCalendarButton } from '@/components/AddToCalendarButton/AddToCalendarButton';
import { formatEventDateRange, formatEventTimeRange, eventDayCount } from '@/lib/core/timezone';
import { themeVars, themeFontsHref, themeFontFaceCss } from '@/lib/events/eventTheme';
import styles from './event-detail.module.css';

// Cached page (data comes from the tagged caches in lib/events.ts, refreshed when an event is saved).
export const revalidate = 300;

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
    ? clampDescription(event.content)
    : event.details?.trim()
    ? markdownToDescription(event.details)
    : `Join Triton Gaming for ${event.full_name}${event.location ? ` at ${event.location}` : ''}.`;

  // The card's address carries a fingerprint of what it shows, so a changed poster or title means a new address and a fresh card everywhere.
  const ogUrl = `/api/og/events/${encodeURIComponent(event.slug || event._id)}?v=${ogVersion(eventCardInputs(event), event.location, event.start_date)}`;

  return {
    title,
    description,
    alternates: { canonical: `/events/${event.slug || event._id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
  };
}

// Discord colours the side bar of a link preview with the page's theme colour: an event's own accent, else the brand yellow.
export async function generateViewport({ params }: Params): Promise<Viewport> {
  const { slug } = await params;
  const event = await getEventBySlugOrId(slug);
  return { themeColor: event?.theme?.colors.accent ?? '#ffc72c' };
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
  const venueName = event.venue_name.trim();
  const pin = event.venue_lat != null && event.venue_lng != null ? `${event.venue_lat},${event.venue_lng}` : '';
  // An address wins for the map query (Google finds the exact building); with only a pin, the map points at the pin and carries the venue's name.
  const mapQuery = venueAddress || (pin ? (venueName ? `${pin}(${venueName})` : pin) : '');
  const mapSrc = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}${pin && !venueAddress ? '&z=17' : ''}&output=embed` : null;
  const target = venueAddress || pin;
  const mapsLink = target ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}` : null;
  const directionsLink = target ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}` : null;
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
  const theme = event.theme;
  const fontsHref = themeFontsHref(theme);
  const fontFaceCss = themeFontFaceCss(theme);
  const creditOf = (url: string) => theme?.asset_credits?.[url];
  // The stickers also come back down the page (not just the hero), scattered in the margins and behind the content. The scatter looks random but
  // is seeded from the event's address, so it is the same on every visit and between server and browser.
  const sticks = theme?.stickers ?? [];
  const bodyStickers = (() => {
    if (!sticks.length) return [];
    let seed = 0;
    for (const ch of slug) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
    const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const count = Math.min(9, Math.max(5, sticks.length * 2 + Math.floor(rnd() * 3)));
    let lastSide = rnd() > 0.5, run = 0;
    return Array.from({ length: count }, (_, i) => {
      let right = rnd() > 0.5;
      if (right === lastSide) run++; else run = 0;
      if (run >= 2) { right = !right; run = 0; }   // never three on the same side in a row
      lastSide = right;
      const band = 100 / count;
      return {
        url: sticks[Math.floor(rnd() * sticks.length)],
        top: Math.min(96, Math.max(1, i * band + rnd() * band * 0.9)),
        right,
        rot: Math.round(rnd() * 28 - 14),
        scale: 0.75 + rnd() * 0.6,
        bx: -(2 + rnd() * 3.5),      // how far into the margin on wide screens (rem)
        x: rnd(),                    // where across the width a phone's gap sticker sits (0 = left edge, 1 = right edge)
      };
    });
  })();
  // The poster is whatever picture the event has, shown at its own shape (portrait posters stay portrait): the theme's key art first, else the flyer.
  const posters = theme?.posters?.length ? theme.posters : isExternalFlyer && event.flyer_url ? [event.flyer_url] : [];
  const stickerCount = theme?.stickers.length ?? 0;


  // Fewer stickers get more room: one or two are drawn much bigger, a full set stays at the base size.
  const stickerScale = stickerCount <= 2 ? 1.8 : stickerCount === 3 ? 1.55 : stickerCount === 4 ? 1.35 : stickerCount <= 6 ? 1.15 : 1;

  return (
    <div className={styles.page} style={themeVars(theme) as React.CSSProperties}>
      { }
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }} />
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      {fontFaceCss && <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />}

      <header className={styles.hero} style={{ '--ss': stickerScale } as React.CSSProperties}>
        {posters[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posters[0]} alt="" aria-hidden="true" className={styles.heroBackdrop} />
        ) : (
          <Image src="/images/what_is_triton_gaming_justinlu.jpg" alt="" aria-hidden="true" fill sizes="100vw" className={styles.heroBackdrop} />
        )}
        <div className={styles.heroShade} aria-hidden="true" />
        {theme && theme.stickers.length > 0 && <HeroStickers items={theme.stickers.map((u) => ({ url: u, credit: creditOf(u) }))} scale={stickerScale} />}

        <div className={`${styles.heroInner} ${posters.length ? '' : styles.noPoster}`}>
          <div className={styles.heroCopy}>
            <Link href="/events" className={styles.back} data-avoid>← All events</Link>
            {isPast && <span className={styles.pastBadge} data-avoid>Past event</span>}
            <h1 className={styles.title} data-avoid>{event.full_name}</h1>
            {event.content && <p className={styles.summary} data-avoid>{event.content}</p>}

            {!isPast && (
              <div className={styles.ctaRow} data-avoid>
                <a href="/portal/tickets" className={styles.ticketBtn}>
                  <span className={styles.stubLeft}><Ticket size={20} strokeWidth={1.75} aria-hidden="true" /></span>
                  <span className={styles.stubRight}>
                    {event.audience === 'ucsd_only'
                      ? 'UCSD students: get ticket'
                      : event.ticket_price > 0
                      ? `Get ticket · $${event.ticket_price}`
                      : 'Get ticket · free'}
                    {event.audience !== 'ucsd_only' && event.ticket_price > 0 && <small>free for UCSD students</small>}
                  </span>
                </a>
                <AddToCalendarButton eventId={event._id} className={styles.calBtn} />
                <AddToGoogleCalendarButton event={event} className={styles.calBtn} />
              </div>
            )}
            {!isPast && event.points_value > 0 && (
              <p className={styles.pointsNote} data-avoid><Award size={15} strokeWidth={1.75} aria-hidden="true" /> Check in to earn {event.points_value} reward points</p>
            )}
          </div>

          {posters.length > 0 && <PosterGallery posters={posters} credits={posters.map((u) => creditOf(u))} name={event.full_name} frameClass={styles.poster} tapeClass={styles.tape} />}
        </div>
        {/* Phones: no room to float stickers over the text, so they sit in a row under the poster instead. */}
        {theme && theme.stickers.length > 0 && (
          <div className={styles.stickerShelf}>
            {theme.stickers.map((u, i) => {
              const credit = creditOf(u);
              return (
                <div key={u + i} className={styles.shelfItem} style={{ transform: `rotate(${[-6, 5, -3, 7, -5, 4, -7, 6][i % 8]}deg)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" aria-hidden="true" decoding="async" />
                  {credit && (credit.link
                    ? <a href={credit.link} target="_blank" rel="noopener noreferrer" className={styles.stickerCredit} title={`Sticker by ${credit.name}`}>By {credit.name}</a>
                    : <span className={styles.stickerCredit}>By {credit.name}</span>)}
                </div>
              );
            })}
          </div>
        )}
      </header>

      <div className={styles.body}>
        {bodyStickers.length > 0 && <BodyStickers items={bodyStickers} />}
        {hasPostEventContent && (
          <section className={`${styles.section} ${styles.recap}`} aria-label="Event recap">
            <div className={styles.recapHead}>
              <span className={styles.recapSticker}>It&apos;s a wrap</span>
              <h2 className={styles.recapTitle}>Relive the day</h2>
              <p className={styles.recapSub}>Photos and notes from {event.full_name}.</p>
            </div>
            {event.photo_albums.length > 0 && (
              <div className={styles.albumGrid}>
                {event.photo_albums.map((album, i) => {
                  const preview = albumPreviews[i];
                  return preview?.image ? (
                    <a key={`${album.url}-${i}`} href={album.url} target="_blank" rel="noopener noreferrer" className={styles.albumCard}>
                      {/* Google's own cover collage for the album, not hosted by us, so a plain <img>. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.image} alt={`Cover photo for ${album.title}`} className={styles.albumCardImg} />
                      <span className={styles.albumCardLabel}>
                        <Camera size={15} strokeWidth={1.5} aria-hidden="true" />
                        {album.title}
                        <span className={styles.albumOpen} aria-hidden="true">open album →</span>
                      </span>
                    </a>
                  ) : (
                    <a key={`${album.url}-${i}`} href={album.url} target="_blank" rel="noopener noreferrer" className={styles.photoLink}>
                      <Camera size={15} strokeWidth={1.5} aria-hidden="true" /> {album.title} <span aria-hidden="true">→</span>
                    </a>
                  );
                })}
              </div>
            )}
            {event.post_event_info && (
              <div className={styles.note}>
                <span className={styles.noteLabel}>A note from the team</span>
                <div className={styles.paper}><MarkdownContent>{event.post_event_info}</MarkdownContent></div>
              </div>
            )}
          </section>
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
                {(venueAddress || (venueName && venueName !== event.location)) && <div className={styles.factSub}>{[venueName !== event.location ? venueName : '', venueAddress].filter(Boolean).join(' · ')}</div>}
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
            <div className={styles.paper}><MarkdownContent>{event.details}</MarkdownContent></div>
          </section>
        )}

        {event.page_blocks.length > 0 && <PageBlocks blocks={event.page_blocks} />}

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
              <ScrollShield label="Tap to use the map" className={styles.mapWrap}>
              <iframe
                className={styles.map}
                src={mapSrc}
                title={`Map of ${venueName || venueAddress || 'the venue'}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              </ScrollShield>
              <div className={styles.venueInfo}>
                <div className={styles.venueAddress}><MapPin size={16} strokeWidth={1.75} aria-hidden="true" /> {venueName || venueAddress || 'Approximate location'}</div>
                {venueName && venueAddress && <p className={styles.venueNotes}>{venueAddress}</p>}
                {!venueAddress && pin && <p className={styles.venueNotes}>Approximate location, see the notes for how to find it.</p>}
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
                      <LogoPlate src={sp.logo_url} alt={sp.name} imgClassName={styles.sponsorLogo} />
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
      </div>
    </div>
  );
}
