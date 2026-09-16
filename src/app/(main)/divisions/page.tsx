import Image from 'next/image';
import Link from 'next/link';
import { getDivisions, divisionLogoSrc } from '@/lib/divisions';
import styles from './divisions.module.css';

export const metadata = { title: 'Divisions' };

export default async function DivisionsPage() {
  const divisions = await getDivisions();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Our Divisions</h1>
        <p className={styles.heroSub}>
          Triton Gaming hosts {divisions.length || 10}+ dedicated game divisions — from competitive
          esports to casual communities. Find your squad.
        </p>
      </section>

      <section className={styles.grid}>
        {divisions.length > 0 ? (
          divisions.map((div) => {
            const logoSrc = divisionLogoSrc(div.logo_url);
            return (
              <div key={div.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  {logoSrc ? (
                    <Image
                      src={logoSrc}
                      alt={div.name}
                      width={80}
                      height={80}
                      className={styles.logo}
                    />
                  ) : (
                    <div className={styles.logoFallback}>
                      {div.name[0]}
                    </div>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.divName}>{div.name}</h3>
                  <p className={styles.divDesc}>{div.description || ''}</p>
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.learnMore}>Learn More →</span>
                  {div.discord_url && (
                    <a
                      href={div.discord_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.cardDiscordBtn}
                      aria-label={`Join ${div.name}'s Discord`}
                    >
                      <Image src="/logos/discord.svg" alt="" width={14} height={14} unoptimized /> Discord
                    </a>
                  )}
                </div>
                {/* Stretched link — whole card is clickable through to the
                    division page; the Discord button above sits on top of
                    it (higher z-index) so it stays independently clickable. */}
                <Link href={`/divisions/${div.slug}`} className={styles.cardLink} aria-label={`View ${div.name}`} />
              </div>
            );
          })
        ) : (
          <p className={styles.noContent}>No divisions available</p>
        )}
      </section>
    </div>
  );
}
