import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal/Reveal';
import styles from './LandingAbout.module.css';

interface AboutContent {
  title?: string;
  body?: string;
  cta_text?: string;
  cta_link?: string;
  photo?: string;
  photo_credit?: string;
  photo_credit_url?: string;
}

export default function LandingAbout({ content = {} }: { content?: AboutContent }) {
  const heading  = content.title;
  const body     = content.body;
  const ctaText  = content.cta_text;
  const ctaLink  = content.cta_link;
  // The photo and who took it are editable; until set, the original photo and its credit stay.
  const photo = content.photo || '/images/what_is_triton_gaming_justinlu.jpg';
  const credit = content.photo ? content.photo_credit : (content.photo_credit ?? 'Photo credit: Justin Lu');
  const creditUrl = content.photo ? content.photo_credit_url : (content.photo_credit_url ?? 'https://www.instagram.com/justinzlu/');

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
                src={photo}
                alt="Triton Gaming Event"
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            {credit && (creditUrl ? (
              <a href={creditUrl} target="_blank" rel="noopener noreferrer" className={styles.credit}>{credit}</a>
            ) : (
              <span className={styles.credit}>{credit}</span>
            ))}
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
