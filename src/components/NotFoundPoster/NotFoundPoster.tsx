import Link from 'next/link';
import styles from './NotFoundPoster.module.css';

// A lost-page poster: a taped note with a big 404 and three ways back. Used by the site-wide not-found and the public pages' own.
export default function NotFoundPoster() {
  return (
    <div className={styles.page}>
      <div className={styles.note}>
        <span className={styles.tape} aria-hidden="true" />
        <p className={styles.kicker}>Page not found</p>
        <h1 className={styles.code}>404</h1>
        <p className={styles.line}>This page wandered off. It may have moved, or the link has a typo.</p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>Back to home</Link>
          <Link href="/events" className={styles.secondary}>See events</Link>
          <Link href="/divisions" className={styles.secondary}>Find a division</Link>
        </div>
      </div>
    </div>
  );
}
