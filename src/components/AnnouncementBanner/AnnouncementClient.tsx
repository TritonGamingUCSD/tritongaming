'use client';

import { useEffect, useState } from 'react';
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

// A sticker-style pill in the nav row, between the logo and the Portal / Menu buttons (NavBar places it). Visitors can dismiss it.
export default function AnnouncementClient({ text, link, linkText, tone, label }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // On phones the pill drops to a second row under the buttons, so page headers need that much more room at the top (--banner-offset).
  useEffect(() => {
    const root = document.documentElement;
    if (dismissed) { root.style.setProperty('--banner-offset', '0px'); return; }
    const mq = window.matchMedia('(max-width: 860px)');
    const apply = () => root.style.setProperty('--banner-offset', mq.matches ? '3.6rem' : '0px');
    apply();
    mq.addEventListener('change', apply);
    return () => { mq.removeEventListener('change', apply); root.style.setProperty('--banner-offset', '0px'); };
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className={`${styles.pill} ${styles[tone]}`} role="region" aria-label="Site announcement">
      <span className={styles.tag}>{label}</span>
      <p className={styles.text}>{text}</p>
      {link && <Link href={link} className={styles.cta}>{linkText || 'Learn more'} <span aria-hidden="true">→</span></Link>}
      <button type="button" className={styles.dismiss} onClick={() => setDismissed(true)} aria-label="Dismiss announcement">
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
