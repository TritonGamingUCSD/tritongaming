'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import styles from './AnnouncementBanner.module.css';

interface Props {
  text: string;
  link?: string;
  linkText?: string;
  tone: 'navy' | 'royal' | 'yellow' | 'green' | 'red';
  label: string;
}

// A strip across the very top of the page, in the normal flow: it pushes the page down by its own height
// and scrolls away with it, so it never covers content. The nav is fixed, so it reads --banner-offset (the part of the strip still
// on screen) and sits just beneath the strip, then settles at its usual place once the strip has scrolled off.
export default function AnnouncementClient({ text, link, linkText, tone, label }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (dismissed || !el) { root.style.setProperty('--banner-offset', '0px'); return; }
    let raf = 0;
    const update = () => {
      raf = 0;
      root.style.setProperty('--banner-offset', `${Math.max(0, el.offsetHeight - window.scrollY)}px`);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.style.setProperty('--banner-offset', '0px');
    };
  }, [dismissed, text]);

  if (dismissed) return null;

  return (
    <div ref={ref} className={`${styles.banner} ${styles[tone]}`} role="region" aria-label="Site announcement">
      <span className={styles.tag}>{label}</span>
      <p className={styles.text}>{text}</p>
      {link && <Link href={link} className={styles.cta}>{linkText || 'Learn more'} <span aria-hidden="true">→</span></Link>}
      <button type="button" className={styles.dismiss} onClick={() => setDismissed(true)} aria-label="Dismiss announcement">
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
