'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './me.module.css';

// The tabs of /me. Each is its own address. Rewards is for students only; Portal is for people who hold a role beyond student.
export default function MeTabs({ rewards, portal }: { rewards: boolean; portal: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: '/me/tickets', label: 'My Tickets' },
    { href: '/me/calendar', label: 'Calendar' },
    ...(rewards ? [{ href: '/me/rewards', label: 'Rewards' }] : []),
    { href: '/me/profile', label: 'Profile' },
  ];
  return (
    <nav className={styles.tabs} aria-label="My pages">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={path.startsWith(t.href) ? styles.on : ''} aria-current={path.startsWith(t.href) ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
      {portal && (
        <Link href="/portal" className={styles.portal} prefetch={false}>
          Portal
        </Link>
      )}
    </nav>
  );
}
