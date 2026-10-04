'use client';

import styles from './Footer.module.css';

export default function BackToTop() {
  return (
    <button
      type="button"
      className={styles.toTop}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
    >
      Back to top <span aria-hidden="true">↑</span>
    </button>
  );
}
