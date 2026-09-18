'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import EventCard from '@/components/EventCard/EventCard';
import type { Event } from '@/types';
import styles from './LandingEvents.module.css';

interface LandingEventsProps {
  initialEvents: Event[];
  content?: { label?: string; title?: string };
}

// Below this many events, the infinite-scroll illusion (tripling the list)
// just reads as the same 1-2 cards repeated back to back — looping only
// pays off once there's enough real content to make the seam invisible.
const MIN_EVENTS_TO_LOOP = 5;

export default function LandingEvents({ initialEvents, content = {} }: LandingEventsProps) {
  const { label, title } = content;
  const shouldLoop = initialEvents.length >= MIN_EVENTS_TO_LOOP;
  const [focusedIndex, setFocusedIndex] = useState(shouldLoop ? initialEvents.length : 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const extended = shouldLoop ? [...initialEvents, ...initialEvents, ...initialEvents] : initialEvents;

  const scrollToCard = (index: number, smooth = true) => {
    const container = scrollRef.current;
    const card = cardRefs.current[index];
    if (!container || !card) return;
    const cRect = container.getBoundingClientRect();
    const kRect = card.getBoundingClientRect();
    const offset =
      kRect.left - cRect.left - container.offsetWidth / 2 + card.offsetWidth / 2;
    container.scrollBy({ left: offset, behavior: smooth ? 'smooth' : 'instant' });
  };

  // Seed initial position (middle copy)
  useEffect(() => {
    if (!shouldLoop) return;
    scrollToCard(initialEvents.length, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEvents.length, shouldLoop]);

  // Infinite-scroll jump when reaching edges
  useEffect(() => {
    if (!shouldLoop) return;
    const container = scrollRef.current;
    if (!container) return;
    let timeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const n = initialEvents.length;
        if (focusedIndex === n - 1) {
          const next = 2 * n - 1;
          setFocusedIndex(next);
          scrollToCard(next, false);
        } else if (focusedIndex === 2 * n) {
          setFocusedIndex(n);
          scrollToCard(n, false);
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, initialEvents.length, shouldLoop]);

  if (initialEvents.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Upcoming Events">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.header}>
          <p className={styles.sectionLabel}>{label}</p>
          <h2 className={styles.sectionTitle}>{title}</h2>
        </div>
        <div className={styles.titleActions}>
          <Link href="/events" className={styles.ctaLink}>View All Events →</Link>
        </div>
      </motion.div>
      <div className={`${styles.wrapper} ${shouldLoop ? '' : styles.noLoop}`}>
        <div className={`${styles.carousel} ${shouldLoop ? '' : styles.centered}`} ref={scrollRef} role="list">
          {extended.map((event, index) => (
            <div
              key={`${event._id}-${index}`}
              ref={(el) => { cardRefs.current[index] = el; }}
              onClick={shouldLoop ? () => {
                setFocusedIndex(index);
                scrollToCard(index);
              } : undefined}
              className={`${styles.cardWrapper} ${shouldLoop && focusedIndex !== index ? styles.faded : ''}`}
              role="listitem"
            >
              <EventCard event={event} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
