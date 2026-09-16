import Image from 'next/image';
import Link from 'next/link';
import styles from './EventCard.module.css';
import type { Event } from '@/types';

function formatDateRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const isSameDay = start.toDateString() === end.toDateString();

  if (isSameDay) {
    return start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth() && sameYear;

  const startStr = start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  // Intl.DateTimeFormat has no clean way to render "day + year" without a
  // month — passing month: undefined doesn't just omit it, it falls back to
  // an awkward "2026 (day: 31)" format. Build the same-month case by hand.
  const endStr = sameMonth
    ? `${end.getDate()}, ${end.getFullYear()}`
    : end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `${startStr} – ${endStr}`;
}

function formatTime(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function EventCard({ event }: { event: Event }) {
  const dateStr = formatDateRange(event.start_date, event.end_date);
  const timeStr = formatTime(event.start_date, event.end_date);
  const isExternal = event.flyer_url?.startsWith('http');

  return (
    <article className={styles.card}>
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
