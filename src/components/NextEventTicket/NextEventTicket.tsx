import Link from 'next/link';
import type { Event } from '@/types';
import { formatEventDateRange, formatEventTimeRange, pacificDaysUntil } from '@/lib/core/timezone';
import styles from './NextEventTicket.module.css';

function whenLabel(startISO: string): string {
  const d = pacificDaysUntil(startISO);
  if (d <= 0) return 'Happening now';
  if (d === 1) return 'Tomorrow';
  if (d < 14) return `In ${d} days`;
  return `In ${Math.round(d / 7)} weeks`;
}

export default function NextEventTicket({ event }: { event: Event }) {
  const start = new Date(event.start_date);
  const tz = { timeZone: 'America/Los_Angeles' } as const;
  const month = start.toLocaleDateString('en-US', { ...tz, month: 'short' });
  const day = start.toLocaleDateString('en-US', { ...tz, day: 'numeric' });
  const weekday = start.toLocaleDateString('en-US', { ...tz, weekday: 'long' });
  const dateStr = formatEventDateRange(event.start_date, event.end_date);
  const timeStr = formatEventTimeRange(event.start_date, event.end_date);
  const href = `/events/${event.slug || event._id}`;
  const hasFlyer = event.flyer_url?.startsWith('http');
  const free = !event.requires_ticket || !event.ticket_price;

  return (
    <article className={styles.ticket}>
            <span className={styles.tape} aria-hidden="true" />
            <div className={styles.flyer}>
              {hasFlyer ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.flyer_url} alt={event.full_name} className={styles.flyerImg} />
              ) : (
                <div className={styles.flyerEmpty} aria-hidden="true">
                  <span>{month}</span>
                  <strong>{day}</strong>
                </div>
              )}
            </div>

            <div className={styles.body}>
              <div className={styles.stickerRow}>
                <span className={styles.countdown}>{whenLabel(event.start_date)}</span>
                {event.points_value > 0 && <span className={styles.points}>+{event.points_value} pts</span>}
              </div>

              <div className={styles.dateBlock}>
                <div className={styles.cal} aria-hidden="true">
                  <span className={styles.calMonth}>{month}</span>
                  <span className={styles.calDay}>{day}</span>
                </div>
                <p className={styles.weekday}>{weekday}<span>{timeStr}</span></p>
              </div>

              <h2 className={styles.title}>{event.full_name}</h2>
              <p className={styles.where}>{event.location}</p>
              <p className={styles.range}>{dateStr}</p>

              <div className={styles.actions}>
                <Link href={href} className={styles.button}>
                  {free ? 'See details & RSVP' : 'Get your ticket'} <span aria-hidden="true">→</span>
                </Link>
                <span className={styles.price}>{free ? 'Free' : `$${event.ticket_price}`}</span>
              </div>
            </div>
            <Link href={href} className={styles.cardLink} aria-label={`${event.full_name} details`} tabIndex={-1} />
          </article>
  );
}
