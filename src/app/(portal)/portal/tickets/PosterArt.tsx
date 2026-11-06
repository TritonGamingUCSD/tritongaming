import styles from './tickets.module.css';

// An event's poster for its ticket. With no picture it is a block in the event's color with the first letter, so every ticket still has a face.
export default function PosterArt({ poster, accent, title, className = '' }: { poster?: string | null; accent?: string | null; title: string; className?: string }) {
  return (
    <span className={`${styles.poster} ${className}`} style={{ ['--ev' as string]: accent || 'var(--yellow)' }} aria-hidden="true">
      {poster ? (
        <>
          {/* A blurred copy fills the frame behind the whole poster, so a tall poster is never cut off and there is no empty band. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" loading="lazy" className={styles.posterBack} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" loading="lazy" className={styles.posterImg} />
        </>
      ) : (
        <span className={styles.posterLetter}>{title.trim().slice(0, 1).toUpperCase() || '?'}</span>
      )}
    </span>
  );
}
