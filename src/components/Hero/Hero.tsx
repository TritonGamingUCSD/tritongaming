import Link from 'next/link';
import styles from './Hero.module.css';

export default function Hero() {
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

      {/* Dark overlay for text legibility */}
      <div className={styles.darkOverlay} aria-hidden="true" />

      {/* Bottom gradient fade */}
      <div className={styles.gradient} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.badge}>UC San Diego&apos;s Premier Gaming Org</div>
        <h1 className={styles.title}>We are Triton Gaming</h1>
        <p className={styles.subtitle}>Esports &nbsp;·&nbsp; Events &nbsp;·&nbsp; Community</p>
        <div className={styles.ctaRow}>
          <Link href="/events" className={styles.ctaPrimary}>Explore Events</Link>
          <a
            href="https://discord.gg/tritongaming"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaSecondary}
          >
            Join Discord
          </a>
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

      <div className={styles.scrollCue} aria-hidden="true">
        <div className={styles.scrollMouse}>
          <div className={styles.scrollWheel} />
        </div>
      </div>
    </section>
  );
}
