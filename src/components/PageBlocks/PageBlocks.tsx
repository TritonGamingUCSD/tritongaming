import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import type { PageBlock } from '@/lib/pageBlocks';
import styles from './PageBlocks.module.css';

// Draws a page's blocks as zine pieces. It reads the event theme's CSS variables when they exist (--ev-*), so an event's colors carry
// through; on a division page there are none and it falls back to the site's own look.
export default function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className={styles.blocks}>
      {blocks.map((b) => {
        switch (b.type) {
          case 'text':
            return <div key={b.id} className={`${styles.text} ${styles.paper}`}><MarkdownContent>{b.markdown}</MarkdownContent></div>;
          case 'highlights':
            return (
              <ul key={b.id} className={styles.highlights} data-count={b.items.length}>
                {b.items.map((h, i) => (
                  <li key={i} className={`${styles.note} ${i % 2 ? styles.tiltR : styles.tiltL}`} data-drag>
                    <span className={styles.tape} aria-hidden="true" />
                    {h.label && <span className={styles.noteLabel}>{h.label}</span>}
                    <span className={styles.noteValue}>{h.value}</span>
                  </li>
                ))}
              </ul>
            );
          case 'faq':
            return (
              <div key={b.id} className={styles.faq}>
                {b.items.map((f, i) => (
                  <details key={i} className={styles.qa}>
                    <summary className={styles.q}>{f.q}</summary>
                    <p className={styles.a}>{f.a}</p>
                  </details>
                ))}
              </div>
            );
          case 'gallery':
            return (
              <ul key={b.id} className={styles.gallery}>
                {b.items.map((g, i) => (
                  <li key={i} className={`${styles.print} ${i % 2 ? styles.tiltR : styles.tiltL}`} data-drag>
                    <span className={styles.tape} aria-hidden="true" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt={g.caption || ''} className={styles.photo} loading="lazy" />
                    {g.caption && <span className={styles.caption}>{g.caption}</span>}
                    {g.credit && <span className={styles.credit}>Photo: {g.credit}</span>}
                  </li>
                ))}
              </ul>
            );
        }
      })}
    </div>
  );
}
