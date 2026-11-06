'use client';

import { useState, type ReactNode } from 'react';
import styles from './preview.module.css';

// The same thing in the light and the dark theme at once, side by side, so nobody has to switch. Each side carries its own colours (the dark one is the portal's "dark island"), so everything
// inside that reads the portal's colours, or the Bytecode's own, follows the side it is on rather than the page. A switch above makes both sides phone-wide or as wide as there is room.
export default function ThemePair({ children }: { children: ReactNode }) {
  const [phone, setPhone] = useState(false);
  return (
    <div className={styles.pairWrap}>
      <div className={styles.widths} role="group" aria-label="Width of the two sides">
        <button type="button" className={!phone ? styles.widthOn : ''} aria-pressed={!phone} onClick={() => setPhone(false)}>
          Wide
        </button>
        <button type="button" className={phone ? styles.widthOn : ''} aria-pressed={phone} onClick={() => setPhone(true)}>
          Phone
        </button>
      </div>
      <div className={`${styles.themes} ${phone ? styles.themesPhone : ''}`}>
        <section className={`${styles.pane} ${styles.paneLight}`} aria-label="Light theme">
          <h3>Light</h3>
          {children}
        </section>
        <section className={`${styles.pane} ${styles.paneDark} pp-dark`} aria-label="Dark theme">
          <h3>Dark</h3>
          {children}
        </section>
      </div>
    </div>
  );
}
