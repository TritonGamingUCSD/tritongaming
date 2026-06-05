import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal/Reveal';
import styles from './LandingAbout.module.css';

const VALUES = [
  { icon: '🎮', label: 'Community First' },
  { icon: '🏆', label: 'Competitive Spirit' },
  { icon: '💡', label: 'Industry Exposure' },
];

export default function LandingAbout() {
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
            <h2 className={styles.heading}>Elevating Gaming at UC San Diego</h2>
            <p className={styles.body}>
              Triton Gaming is one of the largest student-run collegiate gaming organizations in
              the country. We&apos;re committed to building unforgettable community experiences,
              championing diversity in gaming, and connecting students with the esports industry.
              Whether you&apos;re a casual player or an aspiring developer — you belong here.
            </p>
            <div className={styles.values}>
              {VALUES.map(({ icon, label }) => (
                <span key={label} className={styles.valueBadge}>
                  {icon} {label}
                </span>
              ))}
            </div>
            <Link href="/about" className={styles.learnMore}>
              Learn More →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
