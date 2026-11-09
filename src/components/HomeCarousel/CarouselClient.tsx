'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import styles from './HomeCarousel.module.css';

export type Slide = { src: string; alt: string; credit: string; creditUrl: string | null; caption: string | null; link: string | null };

// A swipeable photo carousel: arrows, dots, and a slow auto-advance that pauses while a finger or the mouse is on it, while a button has focus, and for good with a pause button. With "reduce motion" on it never moves by itself. The photographer's credit is always under the photo.
export default function CarouselClient({ slides }: { slides: Slide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [reduce, setReduce] = useState(true);

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(q.matches);
    const on = () => setReduce(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  const go = useCallback(
    (n: number) => {
      const el = track.current;
      if (!el) return;
      const k = (n + slides.length) % slides.length;
      el.scrollTo({ left: k * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
      setI(k);
    },
    [slides.length, reduce],
  );

  // keep the dot in step when the person swipes
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))), 80);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (reduce || paused || held || slides.length < 2) return;
    const id = setInterval(() => go(i + 1), 6000);
    return () => clearInterval(id);
  }, [reduce, paused, held, slides.length, go, i]);

  return (
    <section
      className={styles.wrap}
      aria-roledescription="carousel"
      aria-label="Photos from our events"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onTouchStart={() => setHeld(true)}
      onTouchEnd={() => setHeld(false)}
    >
      <div className={styles.track} ref={track} tabIndex={0} aria-live={paused || held ? 'polite' : 'off'}>
        {slides.map((s, n) => {
          const photo = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.src} alt={s.alt} className={styles.img} loading={n === 0 ? 'eager' : 'lazy'} draggable={false} />
          );
          return (
            <figure key={`${s.src}-${n}`} className={styles.slide} role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${slides.length}`}>
              <div className={styles.frame}>
                {s.link ? (
                  <Link href={s.link} className={styles.photoLink}>
                    {photo}
                  </Link>
                ) : (
                  photo
                )}
                {s.caption && <span className={styles.caption}>{s.caption}</span>}
              </div>
              <figcaption className={styles.credit}>
                Photo:{' '}
                {s.creditUrl ? (
                  <a href={s.creditUrl} target="_blank" rel="noopener noreferrer">
                    {s.credit}
                  </a>
                ) : (
                  s.credit
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
      {slides.length > 1 && (
        <div className={styles.controls}>
          <button type="button" className={styles.btn} aria-label="Previous photo" onClick={() => go(i - 1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className={styles.dots} role="tablist" aria-label="Choose a photo">
            {slides.map((_, n) => (
              <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`Photo ${n + 1}`} className={n === i ? styles.dotOn : ''} onClick={() => go(n)} />
            ))}
          </div>
          {!reduce && (
            <button type="button" className={styles.btn} aria-label={paused ? 'Play slideshow' : 'Pause slideshow'} onClick={() => setPaused((v) => !v)}>
              {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
          )}
          <button type="button" className={styles.btn} aria-label="Next photo" onClick={() => go(i + 1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
