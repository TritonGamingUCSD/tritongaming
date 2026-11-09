import Link from 'next/link';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import CarouselClient from '@/components/HomeCarousel/CarouselClient';
import { videoEmbed, type PageBlock } from '@/lib/site/pageBlocks';
import CountdownBlock from './CountdownBlock';
import styles from './PageBlocks.module.css';

const host = () => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').host || undefined;
  } catch {
    return undefined;
  }
};
const isOwn = (href: string) => href.startsWith('/') || href.startsWith('#');
function A({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return isOwn(href) && !href.startsWith('#') ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} {...(href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

// Draws a page's blocks as zine pieces. It reads the event theme's CSS variables when they exist (--ev-*), so an event's colors carry
// through; on a division page there are none and it falls back to the site's own look. Each block can sit on a colored band, be narrower or wider, centered,
// have more or less space around it, be left out on a phone or a computer, and carry an anchor to link to.
export default function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className={styles.blocks}>
      {blocks.map((b) => {
        const s = b.style ?? {};
        const cls = [
          styles.wrap,
          s.bg && styles[`bg_${s.bg}`],
          s.width && styles[`w_${s.width}`],
          s.align && styles.center,
          s.space && styles[`sp_${s.space}`],
          s.hide && styles[`hide_${s.hide}`],
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <section key={b.id} id={s.anchor} data-block={b.type} className={cls}>
            <Block b={b} />
          </section>
        );
      })}
    </div>
  );
}

function Block({ b }: { b: PageBlock }) {
  switch (b.type) {
    case 'text':
      return (
        <div className={`${styles.text} ${styles.paper}`}>
          <MarkdownContent>{b.markdown}</MarkdownContent>
        </div>
      );
    case 'highlights':
      return (
        <ul className={styles.highlights} data-count={b.items.length}>
          {b.items.map((h, i) => (
            <li key={i} className={`${styles.note} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
              <span className={styles.tape} aria-hidden="true" />
              {h.label && <span className={styles.noteLabel}>{h.label}</span>}
              <span className={styles.noteValue}>{h.value}</span>
            </li>
          ))}
        </ul>
      );
    case 'faq':
      return (
        <div className={styles.faq}>
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
        <ul className={styles.gallery}>
          {b.items.map((g, i) => (
            <li key={i} className={`${styles.print} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
              <span className={styles.tape} aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt={g.caption ? '' : g.credit ? `Photo by ${g.credit}` : 'Event photo'} className={styles.photo} loading="lazy" />
              {g.caption && <span className={styles.caption}>{g.caption}</span>}
              {g.credit && <span className={styles.credit}>Photo: {g.credit}</span>}
            </li>
          ))}
        </ul>
      );
    case 'hero':
      return (
        <div className={styles.hero} style={b.image ? { backgroundImage: `linear-gradient(rgba(1,25,65,0.55), rgba(1,25,65,0.75)), url("${b.image}")` } : undefined}>
          <h2>{b.title}</h2>
          {b.sub && <p>{b.sub}</p>}
          {b.buttonLabel && b.buttonUrl && (
            <A href={b.buttonUrl} className={styles.btnPrimary}>
              {b.buttonLabel}
            </A>
          )}
          {b.image && b.credit && <small className={styles.heroCredit}>Photo: {b.credit}</small>}
        </div>
      );
    case 'imageText':
      return (
        <div className={`${styles.imageText} ${b.side === 'right' ? styles.imageRight : ''}`}>
          {b.image && (
            <figure className={styles.itPhoto}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt={b.alt} loading="lazy" />
              {b.credit && <figcaption>Photo: {b.credit}</figcaption>}
            </figure>
          )}
          {b.markdown && (
            <div className={`${styles.itText} ${styles.paper}`}>
              <MarkdownContent>{b.markdown}</MarkdownContent>
            </div>
          )}
        </div>
      );
    case 'columns':
      return (
        <div className={styles.columns} data-count={b.items.length}>
          {b.items.map((c, i) => (
            <div key={i} className={`${styles.col} ${styles.paper}`}>
              {c.heading && <h3>{c.heading}</h3>}
              {c.markdown && <MarkdownContent>{c.markdown}</MarkdownContent>}
            </div>
          ))}
        </div>
      );
    case 'buttons':
      return (
        <div className={styles.buttons}>
          {b.items.map((x, i) => (
            <A key={i} href={x.url} className={x.kind === 'secondary' ? styles.btnSecondary : styles.btnPrimary}>
              {x.label}
            </A>
          ))}
        </div>
      );
    case 'video': {
      const src = videoEmbed(b.url, host());
      if (!src) return null;
      return (
        <figure className={styles.video}>
          <div className={styles.videoFrame}>
            <iframe src={src} title={b.caption || 'Video'} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          {b.caption && <figcaption>{b.caption}</figcaption>}
        </figure>
      );
    }
    case 'people':
      return (
        <ul className={styles.people}>
          {b.items.map((p, i) => {
            const card = (
              <>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" loading="lazy" />
                ) : (
                  <span className={styles.initial}>{p.name[0]}</span>
                )}
                <b>{p.name}</b>
                {p.role && <small>{p.role}</small>}
              </>
            );
            return (
              <li key={i} className={`${styles.person} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
                {p.url ? <A href={p.url}>{card}</A> : card}
              </li>
            );
          })}
        </ul>
      );
    case 'logos':
      return (
        <ul className={styles.logos}>
          {b.items.map((l, i) => {
            // eslint-disable-next-line @next/next/no-img-element
            const pic = <img src={l.image} alt={l.name} loading="lazy" />;
            return <li key={i}>{l.url ? <A href={l.url}>{pic}</A> : pic}</li>;
          })}
        </ul>
      );
    case 'countdown':
      return <CountdownBlock label={b.label} at={b.at} after={b.after} />;
    case 'divider':
      return (
        <svg className={styles.divider} viewBox="0 0 300 14" fill="none" aria-hidden="true" preserveAspectRatio="none">
          <path d="M2 9 C 40 2, 70 14, 110 7 S 190 3, 230 9 S 280 12, 298 5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case 'carousel':
      return (
        <CarouselClient
          slides={b.items.map((i) => ({ src: i.url, alt: i.alt || 'A photo', credit: i.credit, creditUrl: i.creditUrl || null, caption: i.caption || null, link: null }))}
        />
      );
  }
}
