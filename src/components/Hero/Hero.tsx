import Link from 'next/link';
import Image from 'next/image';
import HeroFx from './HeroFx';
import styles from './Hero.module.css';
import { DISCORD_URL } from '@/lib/links';

interface HeroContent {
  badge?: string;
  title?: string;
  subtitle?: string;
  cta_primary_text?: string;
  cta_primary_href?: string;
  cta_secondary_text?: string;
  cta_secondary_href?: string;
  photo_a?: string;
  photo_a_caption?: string;
  photo_b?: string;
  photo_b_caption?: string;
  photo_a_credit?: string;
  photo_b_credit?: string;
}

// Splits "We are Triton Gaming" so the last two words get the brush treatment: small line on top, big hand-lettered line below.
function splitTitle(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return ['', title];
  return [words.slice(0, -2).join(' '), words.slice(-2).join(' ')];
}

export default function Hero({ content = {} }: { content?: HeroContent }) {
  const badge            = content.badge              || "Gaming Org at UC San Diego";
  const title            = content.title              || 'We are Triton Gaming';
  const subtitle         = content.subtitle           || 'Game · Events · Community';
  const ctaPrimaryText   = content.cta_primary_text   || 'Explore Events';
  const ctaPrimaryHref   = content.cta_primary_href   || '/events';
  const ctaSecondaryText = content.cta_secondary_text || 'Join Discord';
  const ctaSecondaryHref = content.cta_secondary_href || DISCORD_URL;
  const photoA = content.photo_a || '/images/home/p-cosplay.jpg';
  const photoB = content.photo_b || '/images/home/p-stream.jpg';
  const captionA = content.photo_a_caption ?? 'panel night';
  const captionB = content.photo_b_caption ?? 'the doodle wall';
  const [lead, brush] = splitTitle(title);

  const button = (href: string, text: string, className: string) =>
    href.startsWith('http')
      ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{text}</a>
      : <Link href={href} className={className}>{text}</Link>;

  return (
    <section className={styles.hero} aria-label="Hero">
      <HeroFx />
      <video autoPlay loop muted playsInline className={styles.video} aria-hidden="true">
        <source src="/videos/tgex26highlight_1920x1080.mp4" type="video/mp4" />
      </video>
      <div className={styles.darkOverlay} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.kicker} data-hero-in>{badge}</span>
          <h1 className={styles.title} data-hero-in>
            {lead && <span className={styles.lead}>{lead}</span>}
            <span className={styles.brush}>{brush}</span>
          </h1>
          <span className={styles.strip} data-hero-in>{subtitle}</span>
          <div className={styles.ctaRow} data-hero-in>
            {button(ctaPrimaryHref, ctaPrimaryText, styles.ctaPrimary)}
            {button(ctaSecondaryHref, ctaSecondaryText, styles.ctaSecondary)}
          </div>
        </div>

        <div className={styles.photos} aria-hidden="true">
          <figure className={`${styles.photo} ${styles.photoA}`} data-hero-in data-hero-float>
            <span className={styles.tape} />
            <Image src={photoA} alt="" width={560} height={315} sizes="(max-width: 860px) 60vw, 28vw" />
            {captionA && <figcaption>{captionA}</figcaption>}
            {content.photo_a_credit && <span className={styles.credit}>{content.photo_a_credit}</span>}
          </figure>
          <figure className={`${styles.photo} ${styles.photoB}`} data-hero-in data-hero-float>
            <span className={`${styles.tape} ${styles.tapeR}`} />
            <Image src={photoB} alt="" width={560} height={315} sizes="(max-width: 860px) 56vw, 24vw" />
            {captionB && <figcaption>{captionB}</figcaption>}
            {content.photo_b_credit && <span className={styles.credit}>{content.photo_b_credit}</span>}
          </figure>
          <svg className={styles.arrow} viewBox="0 0 150 90"><path data-hero-arrow pathLength="100" d="M6 70 C 30 20, 80 10, 128 40 M128 40 L 108 30 M128 40 L 112 58" /></svg>
        </div>
      </div>

      <div className={styles.tapeBand} aria-hidden="true">
        <div className={styles.tapeTrack}>
          {Array.from({ length: 4 }).flatMap((_, r) => ['Events', 'Creativity', 'Community', 'Industry'].map((w, i) => (
            <span key={`${r}-${i}`}>{w} <i>#</i></span>
          )))}
        </div>
      </div>
    </section>
  );
}
