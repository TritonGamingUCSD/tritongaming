import Image from 'next/image';
import { Reveal, RevealGroup, RevealItem } from '@/components/Reveal/Reveal';
import divisions from '@/data/divisions.json';
import styles from './LandingDivisions.module.css';

interface DivisionEntry {
  name: string;
  logo: string;
  link?: string;
  description?: string;
}

export default function LandingDivisions() {
  const sorted = [...(divisions as DivisionEntry[])].sort((a, b) => {
    const oa = (a as { order?: number }).order ?? 99;
    const ob = (b as { order?: number }).order ?? 99;
    return oa - ob;
  });

  return (
    <section className={styles.section} aria-label="Divisions">
      <Reveal variant="fadeUp">
        <div className={styles.header}>
          <p className={styles.sectionLabel}>OUR DIVISIONS</p>
          <h2 className={styles.sectionTitle}>Compete. Connect. Create.</h2>
          <p className={styles.sectionSub}>
            Ten active divisions spanning competitive esports, casual gaming, and creative arts.
          </p>
        </div>
      </Reveal>

      <RevealGroup>
        <div className={styles.grid}>
          {sorted.map((div) => {
            const logoSrc = div.logo ? (div.logo.startsWith('/') ? div.logo : `/${div.logo}`) : null;
            const Tag = div.link ? 'a' : 'div';
            const linkProps = div.link
              ? { href: div.link, target: '_blank' as const, rel: 'noopener noreferrer' }
              : {};
            return (
              <RevealItem key={div.name}>
                <Tag className={styles.card} {...linkProps}>
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
                </Tag>
              </RevealItem>
            );
          })}
        </div>
      </RevealGroup>
    </section>
  );
}
