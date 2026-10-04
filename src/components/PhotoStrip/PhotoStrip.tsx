import Image from 'next/image';
import { ZineBand, type BandTone } from '@/components/ZineBand/ZineBand';
import type { SitePhoto } from '@/lib/sitePhotos';
import styles from './PhotoStrip.module.css';

// A row of taped prints with hand-written captions. Every photo shows its credit; a missing photo shows a stand-in with a credit slot
// so the layout never has a hole (use `placeholders` until the real picture exists).
export default function PhotoStrip({ photos, caption, tone = 'ink', placeholders = 0 }: { photos: SitePhoto[]; caption?: string; tone?: BandTone; placeholders?: number }) {
  return (
    <ZineBand tone={tone} label="Photos">
      {caption && <p className={styles.caption}>{caption}</p>}
      <ul className={styles.strip} data-no-touch-drag>
        {photos.map((p, i) => (
          <li key={p.src} className={`${styles.print} ${styles[`t${i % 3}`]}`} data-drag>
            <span className={styles.tape} aria-hidden="true" />
            <div className={styles.photo}>
              <Image src={p.src} alt={p.alt} fill sizes="(max-width: 640px) 80vw, 360px" style={{ objectFit: 'cover' }} />
            </div>
            <span className={styles.credit}>
              Photo:{' '}
              {p.creditUrl ? <a href={p.creditUrl} target="_blank" rel="noopener noreferrer">{p.credit}</a> : p.credit}
            </span>
          </li>
        ))}
        {Array.from({ length: placeholders }, (_, i) => (
          <li key={`ph-${i}`} className={`${styles.print} ${styles[`t${(photos.length + i) % 3}`]}`}>
            <span className={styles.tape} aria-hidden="true" />
            <div className={`${styles.photo} ${styles.empty}`}><span>your photo here</span></div>
            <span className={styles.credit}>Photo: credit goes here</span>
          </li>
        ))}
      </ul>
    </ZineBand>
  );
}
