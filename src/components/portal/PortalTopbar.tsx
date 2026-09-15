'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './PortalTopbar.module.css';

// Sole job: get back to the hub from a standalone page (event edit, event
// check-ins, etc. — the few pages that don't have a hub card of their own).
// Hidden on /portal itself since "back to dashboard" is meaningless there.
export default function PortalTopbar() {
  const pathname = usePathname();
  if (pathname === '/portal') return null;

  return (
    <div className={styles.topbar}>
      <Link href="/portal" className={styles.backLink}>
        <span aria-hidden="true">←</span> Dashboard
      </Link>
    </div>
  );
}
