import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal/Reveal';
import styles from './LandingAbout.module.css';

const VALUES = [
  { icon: '🎮', label: 'Community First' },
  { icon: '🏆', label: 'Competitive Spirit' },
  { icon: '💡', label: 'Industry Exposure' },
];

interface AboutContent {
  title?: string;
  body?: string;
  cta_text?: string;
  cta_link?: string;
}

export default function LandingAbout({ content = {} }: { content?: AboutContent }) {
  const heading  = content.title    || 'Elevating Gaming at UC San Diego';
  const body     = content.body     || 'Triton Gaming is one of the largest student-run collegiate gaming organizations in the country. We\'re committed to building unforgettable community experiences, championing diversity in gaming, and connecting students with the esports industry. Whether you\'re a casual player or an aspiring developer — you belong here.';
  const ctaText  = content.cta_text || 'Learn More →';
  const ctaLink  = content.cta_link || '/about';

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <Reveal delay={0}>
          <div className={styles.imageWrapper}>
            <Image
              src="/images/scribble.png"
              alt=""
              fill
              aria-hidden="true"
              className={styles.scribble}
              unoptimized
            />
            <div className={styles.photo}>
              <Image
                src="/images/what_is_triton_gaming_justinlu.jpg"
                alt="Triton Gaming Event"
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <a
              href="https://www.instagram.com/justinzlu/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.credit}
            >
              Photo credit: Justin Lu
            </a>

            {/* Floating glass cluster, layered over the photo's corner
                instead of sitting flat in the text column below. */}
            <div className={styles.valuesFloat}>
              {VALUES.map(({ icon, label }) => (
                <span key={label} className={styles.valueBadge}>
                  {icon} {label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className={styles.text}>
            <p className={styles.sectionLabel}>WHO WE ARE</p>
            <h2 className={styles.heading}>{heading}</h2>
            <p className={styles.body}>{body}</p>
            {ctaLink.startsWith('http') ? (
              <a href={ctaLink} target="_blank" rel="noopener noreferrer" className={styles.learnMore}>
                {ctaText}
              </a>
            ) : (
              <Link href={ctaLink} className={styles.learnMore}>{ctaText}</Link>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
