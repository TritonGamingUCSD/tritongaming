'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './PosterGallery.module.css';

// The event page's poster: one taped print, or several. With more than one there are previous / next buttons and a row of small
// thumbnails; the print itself keeps the same frame and tilt so the hero layout never changes.
export default function PosterGallery({ posters, credits = [], name, frameClass, tapeClass }: { posters: string[]; credits?: ({ name: string; link?: string } | undefined)[]; name: string; frameClass: string; tapeClass: string }) {
  const [i, setI] = useState(0);
  const many = posters.length > 1;
  const credit = credits[i];
  const go = (n: number) => setI((n + posters.length) % posters.length);

  return (
    <div className={styles.wrap}>
      <figure className={frameClass}>
        <span className={tapeClass} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={posters[i]} src={posters[i]} alt={many ? `${name} poster ${i + 1} of ${posters.length}` : `${name} poster`} className={styles.img} />
        {many && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.prev}`} onClick={() => go(i - 1)} aria-label="Previous poster"><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => go(i + 1)} aria-label="Next poster"><ChevronRight size={20} aria-hidden="true" /></button>
          </>
        )}
      </figure>
      {credit && (
        <p className={styles.credit}>
          By {credit.link ? <a href={credit.link} target="_blank" rel="noopener noreferrer">{credit.name}</a> : credit.name}
        </p>
      )}
      {many && (
        <div className={styles.thumbs} role="group" aria-label="Choose a poster">
          {posters.map((u, n) => (
            <button key={u + n} type="button" className={`${styles.thumb} ${n === i ? styles.thumbOn : ''}`} onClick={() => setI(n)} aria-label={`Show poster ${n + 1}`} aria-current={n === i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
