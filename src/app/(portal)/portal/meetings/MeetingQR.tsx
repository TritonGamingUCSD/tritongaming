'use client';

import styles from './meetings.module.css';
import PortalCode from '@/components/portal/PortalCode';

export function MeetingQR({ payload, size }: { payload: string; size: number }) {
  return (
    <div className={styles.qrCanvas} style={{ width: size, maxWidth: '100%', aspectRatio: '1 / 1' }}>
      <PortalCode use="meeting" payload={payload} />
    </div>
  );
}
