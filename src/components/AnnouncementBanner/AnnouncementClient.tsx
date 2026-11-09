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

// A thin strip across the very top of every public page (NavBar places it above the logo and buttons). Visitors can dismiss it. While it shows, page titles leave room for it (--banner-offset).
export default function AnnouncementClient({ text, link, linkText, tone, label }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--banner-offset', dismissed ? '0px' : '2.4rem');
    return () => root.style.setProperty('--banner-offset', '0px');
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className={`${styles.pill} ${styles[tone]}`} role="region" aria-label="Site announcement">
      <span className={styles.tag}>{label}</span>
      <p className={styles.text}>{text}</p>
      {link && (
        <Link href={link} className={styles.cta}>
          {linkText || 'Learn more'} <span aria-hidden="true">→</span>
        </Link>
      )}
      <button type="button" className={styles.dismiss} onClick={() => setDismissed(true)} aria-label="Dismiss announcement">
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
