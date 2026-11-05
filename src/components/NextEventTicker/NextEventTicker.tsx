import Link from 'next/link';
import { getUpcomingEvents } from '@/lib/events/events';
import { formatEventDateRange } from '@/lib/core/timezone';
import styles from './NextEventTicker.module.css';

// "NEXT ▸ Smash Night · Fri, Nov 7": the club's next event as a ticker in the navbar's HUD. Server-rendered from the cached upcoming-events list, so it costs no extra query; nothing is drawn when no event is coming.
export default async function NextEventTicker() {
  const [next] = await getUpcomingEvents(1);
  if (!next) return null;
  return (
    <Link href={next.slug ? `/events/${next.slug}` : '/events'} className={styles.ticker}>
      <span className={styles.tag}>NEXT</span>
      <span className={styles.text}>
        {next.full_name} <span aria-hidden="true">·</span> {formatEventDateRange(next.start_date, next.end_date)}
      </span>
    </Link>
  );
}
