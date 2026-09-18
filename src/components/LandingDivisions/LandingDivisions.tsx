import Image from 'next/image';
import Link from 'next/link';
import { Reveal, RevealGroup, RevealItem } from '@/components/Reveal/Reveal';
import { getDivisions, divisionLogoSrc } from '@/lib/divisions';
import { getContentBlock } from '@/lib/content';
import styles from './LandingDivisions.module.css';

export default async function LandingDivisions() {
  const [divisions, content] = await Promise.all([
    getDivisions(),
    getContentBlock('homepage.divisions'),
  ]);
  const label = content.label as string;
  const title = content.title as string;
  const subtitle = content.subtitle as string;

  return (
    <section className={styles.section} aria-label="Divisions">
      <Reveal variant="fadeUp">
        <div className={styles.header}>
          <p className={styles.sectionLabel}>{label}</p>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionSub}>{subtitle}</p>
          <Link href="/divisions" className={styles.ctaLink}>View All Divisions →</Link>
        </div>
      </Reveal>

      <RevealGroup>
        <div className={styles.grid}>
          {divisions.map((div) => {
            const logoSrc = divisionLogoSrc(div.logo_url);
            return (
              <RevealItem key={div.id}>
                <div className={styles.card}>
                  {div.discord_url && (
                    <a
                      href={div.discord_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.cardDiscordBtn}
                      aria-label={`Join ${div.name}'s Discord`}
                      title="Join Discord"
                    >
                      <Image src="/logos/discord.svg" alt="" width={16} height={16} unoptimized />
                    </a>
                  )}
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
                  <Link href={`/divisions/${div.slug}`} className={styles.cardLink} aria-label={`View ${div.name}`} />
                </div>
              </RevealItem>
            );
          })}
        </div>
      </RevealGroup>
    </section>
  );
}
