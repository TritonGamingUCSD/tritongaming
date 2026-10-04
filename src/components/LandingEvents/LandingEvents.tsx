import Link from 'next/link';
import type { Event } from '@/types';
import { Reveal } from '@/components/Reveal/Reveal';
import NextEventTicket from '@/components/NextEventTicket/NextEventTicket';
import styles from './LandingEvents.module.css';

interface LandingEventsProps {
  initialEvents: Event[];
  content?: { label?: string; title?: string };
}

// Only the single next event is shown here on purpose: one big, obvious
// ticket beats a row of small cards. Everything else lives on /events.
export default function LandingEvents({ initialEvents, content = {} }: LandingEventsProps) {
  const event = initialEvents[0];
  if (!event) return null;
  return (
    <section className={styles.section} aria-label="Next event">
      <div className={styles.inner}>
        <Reveal>
          <div className={styles.header}>
            <p className={styles.sectionLabel}>{content.label || 'Next up'}</p>
            <Link href="/events" className={styles.ctaLink}>All events →</Link>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <NextEventTicket event={event} />
        </Reveal>
      </div>
    </section>
  );
}
