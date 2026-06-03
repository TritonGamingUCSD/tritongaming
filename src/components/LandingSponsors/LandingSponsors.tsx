import Link from 'next/link';
import LogoGrid from '@/components/LogoGrid/LogoGrid';
import { Reveal } from '@/components/Reveal/Reveal';
import sponsors from '@/data/sponsors.json';
import styles from './LandingSponsors.module.css';
import type { LogoItem } from '@/types';

export default function LandingSponsors() {
  return (
    <section className={styles.section} aria-label="Sponsors">
      <Reveal variant="fadeUp">
        <div className={styles.header}>
          <p className={styles.sectionLabel}>OUR PARTNERS</p>
          <h2 className={styles.sectionTitle}>Backed by the Best</h2>
          <p className={styles.sectionSub}>
            Partnering with leading gaming brands to bring unforgettable experiences to UCSD students.
          </p>
        </div>
      </Reveal>

      <LogoGrid logos={sponsors as LogoItem[]} />

      <Reveal delay={0.2}>
        <div className={styles.cta}>
          <p className={styles.ctaText}>Interested in sponsoring Triton Gaming?</p>
          <Link href="/sponsors" className={styles.ctaLink}>Learn More →</Link>
        </div>
      </Reveal>
    </section>
  );
}
