import Image from 'next/image';
import Link from 'next/link';
import { getContentBlock } from '@/lib/content';
import styles from './divisions.module.css';

export const metadata = { title: 'Divisions' };

interface DivisionEntry {
  name: string;
  logo: string;
  description?: string;
  order?: number;
}

export default async function DivisionsPage() {
  let divisions: DivisionEntry[] = [];
  
  try {
    const content = await getContentBlock('divisions');
    const items = content.items as DivisionEntry[] | undefined;
    if (items?.length) {
      divisions = [...items].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    }
  } catch {
    // Content unavailable
  }

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
            const logoSrc = div.logo ? (div.logo.startsWith('/') ? div.logo : `/${div.logo}`) : null;
            const href = div.name.toLowerCase().replace(/\s+/g, '-');
            return (
              <Link key={div.name} href={`/divisions/${href}`} className={styles.card}>
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
