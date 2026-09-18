import Image from 'next/image';
import Link from 'next/link';
import { Ticket } from 'lucide-react';
import styles from './LongEventCard.module.css';
import type { Event } from '@/types';
import { formatEventDateRange, formatEventTimeRange } from '@/lib/timezone';

export default function LongEventCard({ event }: { event: Event }) {
  const dateStr = formatEventDateRange(event.start_date, event.end_date);
  const timeStr = formatEventTimeRange(event.start_date, event.end_date);
  const isExternal = event.flyer_url?.startsWith('http');
  const isPast = new Date(event.end_date || event.start_date) < new Date();

  return (
    <article className={styles.card}>
      <div className={styles.imgWrapper}>
        {isExternal ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.flyer_url} alt="" aria-hidden="true" className={styles.imgBackdrop} loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.flyer_url} alt={event.full_name} className={styles.img} loading="lazy" />
          </>
        ) : (
          <Image
            src="/images/what_is_triton_gaming_justinlu.jpg"
            alt={event.full_name}
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            style={{ objectFit: 'cover' }}
          />
        )}
      </div>

      <div className={styles.content}>
        <h2 className={styles.title}>{event.full_name}</h2>
        <p className={styles.meta}>
          {dateStr}
          <span className={styles.hash}>#</span>
          {timeStr}
        </p>
        <p className={styles.location}>{event.location}</p>
        <p className={styles.desc}>{event.content}</p>
        <div className={styles.actions}>
          <span className={styles.link} aria-hidden="true">LEARN MORE &gt;</span>
          {!isPast && (
            <a href="/portal/tickets" className={styles.ticketBtn}>
              <Ticket size={16} strokeWidth={1.5} aria-hidden="true" />
              {event.audience === 'ucsd_only'
                ? 'UCSD Students — Get Ticket'
                : event.ticket_price > 0
                ? `Get Ticket — $${event.ticket_price} (free for UCSD)`
                : 'Get Ticket — Free'}
            </a>
          )}
        </div>
      </div>

      {/* Stretched link over the whole card — the "Get Ticket" button stays
          independently clickable on top via its own stacking context (see
          .ticketBtn's z-index), everything else falls through to this. */}
      <Link
        href={`/events/${event.slug || event._id}`}
        className={styles.cardLink}
        aria-label={`Learn more about ${event.full_name}`}
      />
    </article>
  );
}
