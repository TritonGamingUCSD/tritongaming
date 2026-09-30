import Image from 'next/image';
import Link from 'next/link';
import { Award } from 'lucide-react';
import styles from './EventCard.module.css';
import type { Event } from '@/types';
import { formatEventDateRange, formatEventTimeRange } from '@/lib/timezone';

// `compact` = short horizontal card (flyer thumbnail beside the details,
// no description) for the homepage carousel; default is the tall card used
// on the events listing.
export default function EventCard({ event, compact = false }: { event: Event; compact?: boolean }) {
  const dateStr = formatEventDateRange(event.start_date, event.end_date);
  const timeStr = formatEventTimeRange(event.start_date, event.end_date);
  const isExternal = event.flyer_url?.startsWith('http');

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.imgWrapper}>
        {isExternal ? (
          <>
            {/* Blurred, cropped copy of the same flyer fills the card behind
                the real one — lets the actual flyer show uncropped (flyers
                are full of text/details that `cover` used to cut off)
                without leaving dead space around it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.flyer_url} alt="" aria-hidden="true" className={styles.imgBackdrop} loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.flyer_url}
              alt={event.full_name}
              className={styles.img}
              loading="lazy"
            />
          </>
        ) : (
          <Image
            src="/images/what_is_triton_gaming_justinlu.jpg"
            alt={event.full_name}
            fill
            sizes="320px"
            style={{ objectFit: 'cover' }}
          />
        )}
      </div>

      <div className={styles.info}>
        <h3 className={styles.title}>{event.full_name}</h3>
        <p className={styles.meta}>
          {dateStr}
          <span className={styles.hash}>#</span>
          {timeStr}
        </p>
        <p className={styles.location}>{event.location}</p>
        {event.points_value > 0 && (
          <span className={styles.pointsBadge}><Award size={11} strokeWidth={1.75} aria-hidden="true" /> Earn {event.points_value} pts</span>
        )}
        <p className={styles.desc}>
          {event.content.length > 280 ? `${event.content.slice(0, 280)}…` : event.content}
        </p>
        <span className={styles.link} aria-hidden="true">LEARN MORE &gt;</span>
      </div>

      {/* Stretched link — makes the entire card clickable instead of just
          the "Learn More" text, matching the hover lift/shimmer that
          already reacts to the whole card. */}
      <Link
        href={`/events/${event.slug || event._id}`}
        className={styles.cardLink}
        aria-label={`Learn more about ${event.full_name}`}
      />
    </article>
  );
}
