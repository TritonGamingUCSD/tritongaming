import Image from 'next/image';
import styles from './ZineLoader.module.css';

// The public site's loading state: the logo sticker stamps down again and again, a strip of caution tape slides under it, and a hand-written
// line says what is happening. Flat colours and hard shadows only (no glow), and only transform is animated. The portal and sign-in screens keep
// their own loader.
export default function ZineLoader({ label = 'Loading…', fullHeight = true }: { label?: string; fullHeight?: boolean }) {
  return (
    <div className={`${styles.wrap} ${fullHeight ? styles.full : ''}`} role="status" aria-live="polite">
      <div className={styles.stamp} aria-hidden="true">
        <Image src="/logos/tg_logo.png" alt="" width={64} height={64} priority className={styles.logo} />
      </div>
      <div className={styles.tape} aria-hidden="true"><span className={styles.tapeSlide} /></div>
      <p className={styles.label}>{label}</p>
    </div>
  );
}
