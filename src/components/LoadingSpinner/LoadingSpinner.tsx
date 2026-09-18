import styles from './LoadingSpinner.module.css';

interface Props {
  size?: number;
  label?: string;
  // 'dark' = spinner sits on the portal's dark navy background, so the
  // label needs light text; 'light' = the public site's mostly-white
  // content areas, so it needs dark-muted text. The ring itself (a
  // translucent-gold track with a solid-gold leading edge) already reads
  // fine against either background unchanged.
  theme?: 'light' | 'dark';
  // Fills the nearest positioned/flex ancestor at a sensible minimum
  // height and centers the spinner in it — for a whole loading.tsx page
  // or panel, as opposed to a small inline spinner sized to fit next to
  // other content.
  fullHeight?: boolean;
}

// Shared across every loading.tsx (route-level Suspense fallbacks) and any
// component that needs to show "still working" rather than a blank gap
// while its own data is in flight — one visual language for "loading"
// everywhere instead of each spot inventing its own.
export default function LoadingSpinner({ size = 32, label, theme = 'light', fullHeight = false }: Props) {
  const borderWidth = Math.max(2, Math.round(size / 10));
  return (
    <div
      className={`${styles.wrap} ${fullHeight ? styles.fullHeight : ''}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={styles.spinner}
        style={{ width: size, height: size, borderWidth }}
        aria-hidden="true"
      />
      {label ? (
        <p className={`${styles.label} ${theme === 'dark' ? styles.labelDark : styles.labelLight}`}>{label}</p>
      ) : (
        <span className={styles.srOnly}>Loading</span>
      )}
    </div>
  );
}
