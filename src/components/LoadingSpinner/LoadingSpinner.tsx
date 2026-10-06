import styles from './LoadingSpinner.module.css';

interface Props {
  size?: number;
  label?: string;
  // 'dark' = spinner sits on the portal's dark navy background, so the
  // label needs light text; 'light' = the public site's mostly-white
  // content areas, so it needs dark-muted text. The ring itself (a
  // three cut-paper blocks that hop in turn) reads on either background.
  theme?: 'light' | 'dark' | 'auto';
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
  return (
    <div
      className={`${styles.wrap} ${fullHeight ? styles.fullHeight : ''}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`${styles.blocks} ${theme === 'dark' ? styles.blocksDark : theme === 'auto' ? styles.blocksAuto : ''}`}
        style={{ ['--ls' as string]: `${Math.max(8, Math.round(size / 3.2))}px` }}
        aria-hidden="true"
      >
        <span /><span /><span />
      </div>
      {label ? (
        <p className={`${styles.label} ${theme === 'dark' ? styles.labelDark : theme === 'auto' ? styles.labelAuto : styles.labelLight}`}>{label}</p>
      ) : (
        <span className={styles.srOnly}>Loading</span>
      )}
    </div>
  );
}
