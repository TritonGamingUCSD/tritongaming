import { Loader2 } from 'lucide-react';
import styles from './selfCheckin.module.css';

// Shown at once while the check-in page is prepared on the server, so scanning the QR is acknowledged the moment the page starts to arrive (not after the server has finished).
export default function Loading() {
  return (
    <div className={styles.page}>
      <p className={styles.kicker}>Self check-in</p>
      <div className={styles.card} role="status">
        <Loader2 className={styles.spin} size={34} aria-hidden="true" />
        <p className={styles.big}>Checking you in…</p>
      </div>
    </div>
  );
}
