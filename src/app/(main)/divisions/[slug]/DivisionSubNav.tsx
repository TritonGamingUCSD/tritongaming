import Link from 'next/link';
import styles from './division.module.css';

export type DivisionSubPage = 'home' | 'events' | 'team' | 'gallery';
const PAGES: { id: DivisionSubPage; label: string; path: string }[] = [
  { id: 'home', label: 'Home', path: '' },
  { id: 'events', label: 'Events', path: '/events' },
  { id: 'team', label: 'Team', path: '/team' },
  { id: 'gallery', label: 'Gallery', path: '/gallery' },
];

// The division's public pages: /<division>, /<division>/events, /<division>/team and /<division>/gallery (the proxy serves these from /divisions/<division>…).
export default function DivisionSubNav({ slug, current }: { slug: string; current: DivisionSubPage }) {
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
