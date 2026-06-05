'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import EventCard from '@/components/EventCard/EventCard';
import AlternateTitle from '@/components/AlternateTitle/AlternateTitle';
import type { Event } from '@/types';
import styles from './LandingEvents.module.css';

interface LandingEventsProps {
  initialEvents: Event[];
}

export default function LandingEvents({ initialEvents }: LandingEventsProps) {
  const [focusedIndex, setFocusedIndex] = useState(initialEvents.length);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Triple the events for infinite-scroll illusion
  const extended = [...initialEvents, ...initialEvents, ...initialEvents];

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
    scrollToCard(initialEvents.length, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEvents.length]);

  // Infinite-scroll jump when reaching edges
  useEffect(() => {
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
  }, [focusedIndex, initialEvents.length]);

  if (initialEvents.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Upcoming Events">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <AlternateTitle bgTitle="Upcoming Events" fgTitle="Upcoming Events" />
      </motion.div>
      <div className={styles.wrapper}>
        <div className={styles.carousel} ref={scrollRef} role="list">
          {extended.map((event, index) => (
            <div
              key={`${event._id}-${index}`}
              ref={(el) => { cardRefs.current[index] = el; }}
              onClick={() => {
                setFocusedIndex(index);
                scrollToCard(index);
              }}
              className={`${styles.cardWrapper} ${focusedIndex !== index ? styles.faded : ''}`}
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
