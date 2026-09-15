import Link from 'next/link';
import styles from './Hero.module.css';

interface HeroContent {
  badge?: string;
  title?: string;
  subtitle?: string;
  cta_primary_text?: string;
  cta_primary_href?: string;
  cta_secondary_text?: string;
  cta_secondary_href?: string;
}

export default function Hero({ content = {} }: { content?: HeroContent }) {
  const badge            = content.badge              || "UC San Diego's Premier Gaming Org";
  const title            = content.title              || 'We are Triton Gaming';
  const subtitle         = content.subtitle           || 'Esports · Events · Community';
  const ctaPrimaryText   = content.cta_primary_text   || 'Explore Events';
  const ctaPrimaryHref   = content.cta_primary_href   || '/events';
  const ctaSecondaryText = content.cta_secondary_text || 'Join Discord';
  const ctaSecondaryHref = content.cta_secondary_href || 'https://discord.gg/tritongaming';
  const isSecondaryExternal = ctaSecondaryHref.startsWith('http');

  return (
    <section className={styles.hero} aria-label="Hero">
      <video
        autoPlay
        loop
        muted
        playsInline
        className={styles.video}
        aria-hidden="true"
      >
        <source src="/videos/tgexhighlight.mp4" type="video/mp4" />
      </video>

      <div className={styles.darkOverlay} aria-hidden="true" />
      <div className={styles.gradient} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.badge}>{badge}</div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.ctaRow}>
          {ctaPrimaryHref.startsWith('http') ? (
            <a href={ctaPrimaryHref} target="_blank" rel="noopener noreferrer" className={styles.ctaPrimary}>
              {ctaPrimaryText}
            </a>
          ) : (
            <Link href={ctaPrimaryHref} className={styles.ctaPrimary}>{ctaPrimaryText}</Link>
          )}
          {isSecondaryExternal ? (
            <a href={ctaSecondaryHref} target="_blank" rel="noopener noreferrer" className={styles.ctaSecondary}>
              {ctaSecondaryText}
            </a>
          ) : (
            <Link href={ctaSecondaryHref} className={styles.ctaSecondary}>{ctaSecondaryText}</Link>
          )}
        </div>
      </div>

      <div className={styles.tagline} aria-hidden="true">
        <span className={styles.tagWord}>EVENTS</span>
        <span className={styles.tagHash}>#</span>
        <span className={styles.tagWord}>CREATIVITY</span>
        <span className={styles.tagHash}>#</span>
        <span className={styles.tagWord}>COMMUNITY</span>
        <span className={styles.tagHash}>#</span>
        <span className={styles.tagWord}>INDUSTRY</span>
      </div>
    </section>
  );
}
