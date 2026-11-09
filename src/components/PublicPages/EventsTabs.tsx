import Link from 'next/link';
import { getOffSwitches } from '@/lib/portal/featureServer';
import styles from './jumpLinks.module.css';

// The three views of "what's on", one under the other's title on each page: the upcoming events, the calendar, the tournaments. Each is still its own address.
export default async function EventsTabs({ active }: { active: 'events' | 'calendar' | 'tournaments' }) {
  const off = await getOffSwitches().catch(() => [] as string[]);
  const tabs = [
    { id: 'events', href: '/events', label: 'Events' },
    { id: 'calendar', href: '/calendar', label: 'Calendar' },
    ...(off.includes('tournaments') ? [] : [{ id: 'tournaments', href: '/tournaments', label: 'Tournaments' }]),
  ];
  return (
    <nav className={styles.jump} aria-label="Events views">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={t.id === active ? 'page' : undefined} className={t.id === active ? styles.on : ''}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
