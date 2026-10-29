'use client';

import Link from 'next/link';
import TGcodeIcon from '@/components/TGcode/TGcodeIcon';
import { useTouchDevice } from '@/lib/ui/useTouchDevice';
import styles from './PortalThemeToggle.module.css';

// The Scan button for touch screens wide enough to have no bottom bar (a tablet at the door): it opens the same Scan page. A computer gets nothing, as it has no camera to point.
export default function ScanLink() {
  const touch = useTouchDevice();
  if (!touch) return null;
  return (
    <Link href="/portal/scan" prefetch={false} className={styles.btn} aria-label="Scan a code" title="Scan a code">
      <TGcodeIcon size={20} />
    </Link>
  );
}
