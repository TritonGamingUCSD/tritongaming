import Image from 'next/image';
import { Reveal, RevealGroup, RevealItem } from '@/components/Reveal/Reveal';
import { getContentBlock } from '@/lib/content';
import styles from './LandingDivisions.module.css';

interface DivisionEntry {
  name: string;
  logo: string;
  link?: string;
  description?: string;
  order?: number;
  size?: string;
}

export default async function LandingDivisions() {
  let sorted: DivisionEntry[] = [];
  
  try {
    const content = await getContentBlock('divisions');
    const items = content.items as DivisionEntry[] | undefined;
    if (items?.length) {
      sorted = [...items].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    }
  } catch { /* fallback to empty */ }

  if (!sorted.length) {
    sorted = [];
  }

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
