'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/ui/useOnlineStatus';
import styles from './ConnectivityBanner.module.css';

// A subtle, non-alarming strip rather than a blocking modal — being offline
// isn't necessarily an error state here (most of the site still works from
// whatever's already loaded), it's just something worth surfacing instead
// of pages silently hanging or failing with no explanation.
export default function ConnectivityBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className={styles.banner} role="status">
      <WifiOff size={14} strokeWidth={1.75} aria-hidden="true" />
      You&apos;re offline — reconnecting…
    </div>
  );
}
