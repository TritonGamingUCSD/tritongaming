import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import divisionsJson from '@/data/divisions.json';
import styles from './divisions.module.css';

export const metadata = { title: 'Divisions' };

interface DivisionRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  color: string;
  discord_link: string | null;
  order_index: number;
}

function getLocalLogo(name: string): string | null {
  const entry = (divisionsJson as Array<{ name: string; logo: string }>).find(
    (d) => d.name === name
  );
  return entry?.logo ? `/${entry.logo}` : null;
}

export default async function DivisionsPage() {
  let divisions: DivisionRow[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('divisions')
      .select('*')
      .eq('is_active', true)
      .order('order_index');
    divisions = (data ?? []) as DivisionRow[];
  } catch {
    // Supabase unavailable — render static placeholder
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
        {divisions.length > 0
          ? divisions.map((div) => {
              const logoSrc = div.logo_url || getLocalLogo(div.name);
              return (
                <Link key={div.id} href={`/divisions/${div.slug}`} className={styles.card}>
                  <div
                    className={styles.cardHeader}
                    style={{ background: `linear-gradient(135deg, ${div.color}33, ${div.color}11)` }}
                  >
                    {logoSrc ? (
                      <Image
                        src={logoSrc}
                        alt={div.name}
                        width={80}
                        height={80}
                        className={styles.logo}
                      />
                    ) : (
                      <div className={styles.logoFallback} style={{ background: div.color + '33', color: div.color }}>
                        {div.name[0]}
                      </div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <h3 className={styles.divName}>{div.name}</h3>
                    <p className={styles.divDesc}>{div.description}</p>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.learnMore}>Learn More →</span>
                    {div.discord_link && (
                      <span className={styles.discordBadge}>Discord</span>
                    )}
                  </div>
                </Link>
              );
            })
          : (divisionsJson as Array<{ name: string; logo: string; description: string; order: number }>)
              .sort((a, b) => a.order - b.order)
              .map((div) => (
                <div key={div.name} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <Image
                      src={`/${div.logo}`}
                      alt={div.name}
                      width={80}
                      height={80}
                      className={styles.logo}
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <h3 className={styles.divName}>{div.name}</h3>
                    <p className={styles.divDesc}>{div.description}</p>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.learnMore}>Coming Soon</span>
                  </div>
                </div>
              ))}
      </section>
    </div>
  );
}
