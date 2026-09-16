import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal/Reveal';
import styles from './LandingAbout.module.css';

interface AboutContent {
  title?: string;
  body?: string;
  cta_text?: string;
  cta_link?: string;
}

export default function LandingAbout({ content = {} }: { content?: AboutContent }) {
  const heading  = content.title;
  const body     = content.body;
  const ctaText  = content.cta_text;
  const ctaLink  = content.cta_link;

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
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className={styles.text}>
            <p className={styles.sectionLabel}>WHO WE ARE</p>
            <h2 className={styles.heading}>{heading || ' '}</h2>
            {body && <p className={styles.body}>{body}</p>}
            {ctaText && (ctaLink?.startsWith('http') ? (
              <a href={ctaLink} target="_blank" rel="noopener noreferrer" className={styles.learnMore}>
                {ctaText}
              </a>
            ) : (
              <Link href={ctaLink || '#'} className={styles.learnMore}>{ctaText}</Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
