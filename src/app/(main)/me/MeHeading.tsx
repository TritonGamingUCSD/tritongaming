'use client';

import { usePathname } from 'next/navigation';
import styles from './me.module.css';

// The title of each /me page, drawn like the main site's page titles: a yellow sticker label, the display heading and the hand-drawn line under it.
const PAGES: { path: string; label: string; title: string }[] = [
  { path: '/me/events', label: "What's On", title: 'Events' },
  { path: '/me/tickets', label: 'Your Passes', title: 'My Tickets' },
  { path: '/me/calendar', label: 'Plan Ahead', title: 'Calendar' },
  { path: '/me/rewards', label: 'Show Up, Level Up', title: 'Rewards' },
  { path: '/me/profile', label: 'All About You', title: 'Profile' },
  { path: '/me/help', label: 'We Are Here', title: 'Help' },
];

export default function MeHeading() {
  const path = usePathname();
  const page = PAGES.find((p) => path.startsWith(p.path));
  if (!page) return null;
  return (
    <header className={styles.title}>
      <p>{page.label}</p>
      <h1>{page.title}</h1>
      <svg viewBox="0 0 300 14" fill="none" aria-hidden="true" preserveAspectRatio="none">
        <path d="M2 9 C 40 2, 70 14, 110 7 S 190 3, 230 9 S 280 12, 298 5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </header>
  );
}
