import styles from './jumpLinks.module.css';

// Sticker links that jump to a section of a long page (a merged page like Join or About).
export default function JumpLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <nav className={styles.jump} aria-label="On this page">
      {links.map((l) => (
        <a key={l.href} href={l.href}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
