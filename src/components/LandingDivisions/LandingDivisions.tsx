import Image from 'next/image';
import Link from 'next/link';
import { Reveal, RevealGroup, RevealItem } from '@/components/Reveal/Reveal';
import { getDivisions, divisionLogoSrc } from '@/lib/divisions';
import styles from './LandingDivisions.module.css';

export default async function LandingDivisions() {
  const divisions = await getDivisions();

  return (
    <section className={styles.section} aria-label="Divisions">
      <Reveal variant="fadeUp">
        <div className={styles.header}>
          <p className={styles.sectionLabel}>OUR DIVISIONS</p>
          <h2 className={styles.sectionTitle}>Compete. Connect. Create.</h2>
          <p className={styles.sectionSub}>
            Ten active divisions spanning competitive esports, casual gaming, and creative arts.
          </p>
          <Link href="/divisions" className={styles.ctaLink}>View All Divisions →</Link>
        </div>
      </Reveal>

      <RevealGroup>
        <div className={styles.grid}>
          {divisions.map((div) => {
            const logoSrc = divisionLogoSrc(div.logo_url);
            return (
              <RevealItem key={div.id}>
                <Link href={`/divisions/${div.slug}`} className={styles.card}>
                  {logoSrc && (
                    <div className={styles.logoWrap}>
                      <Image
                        src={logoSrc}
                        alt={div.name}
                        fill
                        sizes="80px"
                        style={{ objectFit: 'contain' }}
                        unoptimized
                      />
                    </div>
                  )}
                  <span className={styles.divName}>{div.name}</span>
                  {div.description && (
                    <span className={styles.divDesc}>{div.description}</span>
                  )}
                </Link>
              </RevealItem>
            );
          })}
        </div>
      </RevealGroup>
    </section>
  );
}
