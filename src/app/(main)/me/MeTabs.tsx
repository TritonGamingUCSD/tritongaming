'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Award, CalendarCheck, CalendarDays, CircleHelp, LayoutDashboard, Ticket, User } from 'lucide-react';
import styles from './me.module.css';

// The tabs of /me. Each is its own address. On a computer they are a row of tabs under the header; on a phone they are a bar at the bottom, in reach of a thumb. Rewards is for students only; Portal is for people who hold a role beyond student.
export default function MeTabs({ rewards, portal }: { rewards: boolean; portal: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: '/me/events', label: 'Events', Icon: CalendarCheck },
    { href: '/me/tickets', label: 'Tickets', Icon: Ticket },
    { href: '/me/calendar', label: 'Calendar', Icon: CalendarDays },
    ...(rewards ? [{ href: '/me/rewards', label: 'Rewards', Icon: Award }] : []),
    { href: '/me/profile', label: 'Profile', Icon: User },
    { href: '/me/help', label: 'Help', Icon: CircleHelp },
  ];
  return (
    <nav className={styles.tabs} aria-label="My pages">
      {tabs.map(({ href, label, Icon }) => {
        const on = path.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? styles.on : ''} aria-current={on ? 'page' : undefined}>
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
      {portal && (
        <Link href="/portal" className={styles.portal} prefetch={false}>
          <LayoutDashboard size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>Portal</span>
        </Link>
      )}
    </nav>
  );
}
