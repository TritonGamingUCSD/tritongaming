'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './AnnouncementBanner.module.css';

interface Props {
  text: string;
  link?: string;
  linkText?: string;
  colors: { bg: string; text: string; border: string };
}

export default function AnnouncementClient({ text, link, linkText, colors }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Tucks away on scroll, same as the nav pill below it, so the two read as
  // one set rather than the toast lingering after the nav has hidden.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`${styles.banner} ${scrolled ? styles.hidden : ''}`}
      style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
      role="banner"
      aria-label="Site announcement"
    >
      <span className={styles.text}>{text}</span>

      {link && (
        <Link
          href={link}
          className={styles.cta}
          style={{ color: colors.text, borderColor: colors.border }}
        >
          {linkText || 'Learn More'}
        </Link>
      )}

      <button
        className={styles.dismiss}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
      >
        ✕
      </button>
    </div>
  );
}
