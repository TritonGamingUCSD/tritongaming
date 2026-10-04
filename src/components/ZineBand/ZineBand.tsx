import ZineMotion from '@/components/ZineMotion/ZineMotion';
import styles from './ZineBand.module.css';

// Background rhythm for the public pages. Every page is a stack of flat bands, never a gradient:
//   ink   – the default night-blue page colour (heroes, long lists)
//   navy  – one step lighter; used for the "main thing" on a page so it lifts off the ink
//   deep  – darker than ink; used for archives/galleries so the page changes tone without ever getting bright.
// The website stays dark everywhere: the brightest thing a background ever gets is navy.
// Bands that change colour get a cut-paper zigzag edge; a band that matches the one above it stays flush.
export type BandTone = 'ink' | 'navy' | 'deep';

export function ZineBand({
  tone = 'ink',
  edge = true,
  children,
  className = '',
  id,
  label,
}: {
  tone?: BandTone;
  edge?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
  label?: string;
}) {
  return (
    <section id={id} aria-label={label} className={`${styles.band} ${styles[tone]} ${edge ? styles.edge : ''} ${className}`}>
      <div className={styles.inner} data-rv-inner>{children}</div>
    </section>
  );
}

// A hand-drawn wobbly underline that draws itself (see ZineMotion).
function Scribble({ className, hero = false }: { className: string; hero?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 300 14" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <path d="M2 9 C 40 2, 70 14, 110 7 S 190 3, 230 9 S 280 12, 298 5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" data-draw {...(hero ? { 'data-draw-hero': '' } : {})} />
    </svg>
  );
}

// Page title block shared by every inner page: sticker label, heading, hand-written line.
export function PageHero({ label, title, sub }: { label?: string; title: string; sub?: string }) {
  return (
    <header className={styles.hero}>
      {/* Mounted inside the page (not the layout) so it only runs once this page has finished hydrating. */}
      <ZineMotion />
      <div className={styles.heroInner}>
        {label && <p className={styles.heroLabel}>{label}</p>}
        <h1 className={styles.heroTitle} data-split data-split-hero>{title}</h1>
        <Scribble className={styles.heroScribble} hero />
        {sub && <p className={styles.heroSub}>{sub}</p>}
      </div>
    </header>
  );
}

export function BandHeader({ label, title, sub }: { label?: string; title: string; sub?: string }) {
  return (
    <div className={styles.head} data-rv-head>
      {label && <p className={styles.headLabel} data-rv-label>{label}</p>}
      <h2 className={styles.headTitle} data-split>{title}</h2>
      <Scribble className={styles.headScribble} />
      {sub && <p className={styles.headSub}>{sub}</p>}
    </div>
  );
}
