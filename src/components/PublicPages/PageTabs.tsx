import Link from 'next/link';
import styles from './jumpLinks.module.css';

// The tabs under the title of a page that holds two parts (About: Our Story and The Team; Join: Get Involved and Membership). Each tab is its own address, so a part can be linked to and the page stays fast.
export default function PageTabs({ label, tabs, active }: { label: string; tabs: { href: string; label: string }[]; active: string }) {
  return (
    <nav className={styles.jump} aria-label={label}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === active ? 'page' : undefined} className={t.href === active ? styles.on : ''}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
