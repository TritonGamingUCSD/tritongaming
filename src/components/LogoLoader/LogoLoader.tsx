import Image from 'next/image';
import styles from './LogoLoader.module.css';

interface Props {
  size?: number;
  label?: string;
  // Same light/dark split as LoadingSpinner — dark for the portal's navy
  // background, light for the public site's mostly-white content areas.
  theme?: 'light' | 'dark';
  fullHeight?: boolean;
}

// Full-page loading state (the four route-level loading.tsx files) — a
// dim copy of the TG logo with a gold sweep traveling left-to-right across
// it on a loop, masked to the logo's own shape (see LogoLoader.module.css).
// Kept separate from LoadingSpinner, which stays the plain ring: this is
// sized and paced for "the whole page is loading," not for a small inline
// spot like a modal or a button's in-flight state, where a big animated
// logo would be out of place.
// Always shows words under the logo — a bare animation doesn't say what it's waiting for.
export default function LogoLoader({ size = 96, label = 'Loading…', theme = 'dark', fullHeight = false }: Props) {
  return (
    <div className={`${styles.wrap} ${fullHeight ? styles.fullHeight : ''}`} role="status" aria-live="polite">
      <div className={styles.logoBox} style={{ width: size, height: size }} aria-hidden="true">
        <Image src="/logos/tg_logo.png" alt="" fill className={styles.logoBase} priority />
        <div className={styles.logoShine} />
      </div>
      <p className={`${styles.label} ${theme === 'dark' ? styles.labelDark : styles.labelLight}`}>{label}</p>
    </div>
  );
}
