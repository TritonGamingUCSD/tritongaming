import Image from 'next/image';
import styles from './Loading.module.css';

// The one loading indicator for the whole site: the logo with a gold sweep (floating gently on the big sizes) and an indeterminate progress bar.
// Its colours come from the surrounding text colour, so it fits the portal in light or dark and the public site's navy without any theme setting.
//   page    the opening screens (loading.tsx): big logo, floating
//   section a panel or sub-page that is waiting for its data
//   inline  a single line ("Loading…") where a list or detail will appear; no logo
// Always has words: a bare animation doesn't say what it is waiting for.
type Variant = 'page' | 'section' | 'inline';

export default function Loading({ variant = 'section', label = 'Loading…' }: { variant?: Variant; label?: string }) {
  if (variant === 'inline') {
    return (
      <div className={styles.inline} role="status" aria-live="polite">
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.fill} />
        </span>
        <span className={styles.inlineLabel}>{label}</span>
      </div>
    );
  }
  const size = variant === 'page' ? 104 : 56;
  return (
    <div className={`${styles.wrap} ${variant === 'page' ? styles.page : styles.section}`} role="status" aria-live="polite">
      <div className={`${styles.logoBox} ${styles.float}`} style={{ width: size, height: size }} aria-hidden="true">
        <Image src="/logos/tg_logo.png" alt="" fill sizes={`${size}px`} className={styles.logoBase} loading="eager" fetchPriority="high" />
        <div className={styles.logoShine} />
      </div>
      <span className={styles.bar} aria-hidden="true">
        <span className={styles.fill} />
      </span>
      <p className={styles.label}>{label}</p>
    </div>
  );
}
