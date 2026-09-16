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

// Floats independently in the bottom-right corner — deliberately NOT part
// of the nav's fixed stack at the top of the page. It used to sit above the
// nav pill and push it down by its own height, but pages give the nav a
// fixed top clearance (--navbar-height), so a showing banner shoved the nav
// down into whatever hero content assumed that fixed clearance was
// accurate. Living in its own corner sidesteps the whole problem instead of
// just tuning around it.
export default function AnnouncementClient({ text, link, linkText, colors }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={styles.banner}
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
