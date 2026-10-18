import RingIcon from '@/components/RingCode/RingIcon';
import styles from './ScanOpening.module.css';

// What shows the instant the Scan button is pressed, until the camera page is there: the same black screen the scanner opens on, so the press is acknowledged at once.
export default function ScanOpening() {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <RingIcon size={44} />
      <p>Opening the camera…</p>
    </div>
  );
}
