import type { ReactNode } from 'react';
import styles from './preview.module.css';

// The same thing in the light and the dark theme at once, side by side, so nobody has to switch. Each side carries its own colours (the dark one is the portal's "dark island"), so everything
// inside that reads the portal's colours, or the Bytecode's own, follows the side it is on rather than the page.
export default function ThemePair({ children }: { children: ReactNode }) {
  return (
    <div className={styles.themes}>
      <section className={`${styles.pane} ${styles.paneLight}`} aria-label="Light theme">
        <h3>Light</h3>
        {children}
      </section>
      <section className={`${styles.pane} ${styles.paneDark} pp-dark`} aria-label="Dark theme">
        <h3>Dark</h3>
        {children}
      </section>
    </div>
  );
}
