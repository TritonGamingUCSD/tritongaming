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
              <Link key={div.id} href={`/divisions/${div.slug}`} className={styles.card}>
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
                </div>
              </Link>
            );
          })
        ) : (
          <p className={styles.noContent}>No divisions available</p>
        )}
      </section>
    </div>
  );
}
