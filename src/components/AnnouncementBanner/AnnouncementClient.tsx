'use client';

import { useState } from 'react';
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
  if (dismissed) return null;

  return (
    <div
      className={styles.banner}
      style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}`, color: colors.text }}
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
        style={{ color: colors.text }}
      >
        ✕
      </button>
    </div>
  );
}
