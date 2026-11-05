import ByteMini from '@/components/Bytecode/ByteMini';
import styles from './Loading.module.css';

// The one loading indicator for the whole site: Byte, hovering gently and blinking (on the big sizes), over an indeterminate progress bar.
// Its colours come from the surrounding text colour, so it fits the portal in light or dark and the public site's navy without any theme setting.
//   page    the opening screens (loading.tsx): big Byte, floating
//   section a panel or sub-page that is waiting for its data
//   inline  a single line ("Loading…") where a list or detail will appear; no Byte
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
  // A panel or sub-page waiting for its data shows the shape of what is coming (a title and a row of cards) instead of the mascot, so the page does not jump when the data arrives.
  if (variant === 'section') {
    return (
      <div className={styles.skeleton} role="status" aria-live="polite" aria-label={label}>
        <span className={`${styles.skBar} ${styles.skTitle}`} />
        <span className={`${styles.skBar} ${styles.skLine}`} />
        <div className={styles.skRow}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`${styles.skBar} ${styles.skCard}`} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <span className={styles.skSr}>{label}</span>
      </div>
    );
  }
  const size = variant === 'page' ? 104 : 56;
  return (
    <div className={`${styles.wrap} ${variant === 'page' ? styles.page : styles.section}`} role="status" aria-live="polite">
      <div className={`${styles.byteBox} ${styles.float}`} style={{ width: size * 1.2 }} aria-hidden="true">
        <ByteMini pose="awake" />
      </div>
      <span className={styles.bar} aria-hidden="true">
        <span className={styles.fill} />
      </span>
      <p className={styles.label}>{label}</p>
    </div>
  );
}
