import Image from 'next/image';
import { Reveal, RevealGroup, RevealItem } from '@/components/Reveal/Reveal';
import { createClient } from '@/lib/supabase/server';
import divisionsJson from '@/data/divisions.json';
import styles from './LandingDivisions.module.css';

interface DivisionEntry {
  name: string;
  logo: string;
  link?: string;
  description?: string;
  order?: number;
}

interface DbDivision {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  order_index: number;
}

export default async function LandingDivisions() {
  let sorted: DivisionEntry[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('divisions')
      .select('id, slug, name, logo_url, description, order_index')
      .eq('is_active', true)
      .order('order_index');
    if (data?.length) {
      sorted = (data as DbDivision[]).map((d) => {
        const local = (divisionsJson as DivisionEntry[]).find((j) => j.name === d.name);
        return {
          name: d.name,
          logo: d.logo_url ?? (local?.logo ? (local.logo.startsWith('/') ? local.logo : `/${local.logo}`) : ''),
          link: `/divisions/${d.slug}`,
          description: d.description ?? local?.description,
          order: d.order_index,
        };
      });
    }
  } catch { /* fallback below */ }

  if (!sorted.length) {
    sorted = [...(divisionsJson as DivisionEntry[])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
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
