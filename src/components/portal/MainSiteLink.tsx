import Link from 'next/link';
import { Globe } from 'lucide-react';
import styles from './PortalThemeToggle.module.css';

// "Main Site": back to the public website, always in the header (a word on a computer, a round icon on a phone).
export default function MainSiteLink({ round = false }: { round?: boolean }) {
  return (
    <Link href="/" prefetch={false} className={`${styles.btn} ${round ? '' : `${styles.wide} ${styles.site}`}`} aria-label="Back to the main site" title="Back to the main site">
      <Globe size={round ? 18 : 16} aria-hidden="true" />
      {!round && <span className={styles.siteLabel}>Main Site</span>}
    </Link>
  );
}
