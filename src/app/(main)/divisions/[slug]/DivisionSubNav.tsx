'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './division.module.css';

export type DivisionSubPage = 'home' | 'events' | 'team' | 'gallery';
const PAGES: { id: DivisionSubPage; label: string; path: string }[] = [
  { id: 'home', label: 'Home', path: '' },
  { id: 'events', label: 'Events', path: '/events' },
  { id: 'team', label: 'Team', path: '/team' },
  { id: 'gallery', label: 'Gallery', path: '/gallery' },
];

// The division's public pages: /<division>, /<division>/events, /<division>/team and /<division>/gallery (the proxy serves these from /divisions/<division>…).
// The page is read from the address (/<division>/<page> or /divisions/<division>/<page>), so the nav can sit in the division's layout above every page.
export default function DivisionSubNav({ slug }: { slug: string }) {
  const parts = (usePathname() ?? '').split('/').filter(Boolean);
  const rest = parts[0] === 'divisions' ? parts.slice(2) : parts.slice(1);
  const current: DivisionSubPage = (['events', 'team', 'gallery'] as const).find((p) => p === rest[0]) ?? 'home';
  return (
    <nav className={styles.subNav} aria-label="Division pages">
      {PAGES.map((p) => (
        <Link
          key={p.id}
          href={`/${slug}${p.path}`}
          className={`${styles.subLink} ${p.id === current ? styles.subLinkOn : ''}`}
          aria-current={p.id === current ? 'page' : undefined}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
