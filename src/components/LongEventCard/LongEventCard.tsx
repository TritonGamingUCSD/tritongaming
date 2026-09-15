import Image from 'next/image';
import Link from 'next/link';
import styles from './LongEventCard.module.css';
import type { Event } from '@/types';

function formatDateRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const s = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const e = end.toLocaleDateString('en-US', { month: sameMonth ? undefined : 'long', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

function formatTime(startISO: string, endISO: string) {
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(new Date(startISO))} – ${fmt(new Date(endISO))}`;
}

export default function LongEventCard({ event }: { event: Event }) {
  const dateStr = formatDateRange(event.start_date, event.end_date);
  const timeStr = formatTime(event.start_date, event.end_date);
  const isExternal = event.flyer_url?.startsWith('http');
  const isPast = new Date(event.end_date || event.start_date) < new Date();

  return (
    <article className={styles.card}>
      <div className={styles.imgWrapper}>
        {isExternal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.flyer_url} alt={event.full_name} className={styles.img} loading="lazy" />
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
          <Link
            href={`/events/${event.slug || event._id}`}
            className={styles.link}
            aria-label={`Learn more about ${event.full_name}`}
          >
            LEARN MORE &gt;
          </Link>
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
        </div>
      </div>
    </article>
  );
}
