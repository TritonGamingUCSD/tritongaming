import Link from 'next/link';
import LogoGrid from '@/components/LogoGrid/LogoGrid';
import { Reveal } from '@/components/Reveal/Reveal';
import { getContentBlock } from '@/lib/content';
import styles from './LandingSponsors.module.css';
import type { LogoItem } from '@/types';

type DbSponsor = { name?: string; logo_url?: string; website_url?: string; tier?: string };

function dbSponsorsToLogoItems(items: DbSponsor[]): LogoItem[] {
  const tierSize: Record<string, 'small' | 'medium' | 'large'> = {
    gold: 'large', silver: 'medium', bronze: 'small', platinum: 'large',
  };
  return items
    .filter((s) => s.name && s.logo_url)
    .map((s, i) => ({
      name: s.name!,
      logo: s.logo_url!,
      size: tierSize[(s.tier ?? '').toLowerCase()] ?? 'medium',
      link: s.website_url,
      order: i,
    }));
}

export default async function LandingSponsors() {
  const content = await getContentBlock('sponsors');
  const dbItems = content.items as DbSponsor[] | undefined;
  const logos: LogoItem[] = dbItems?.length
    ? dbSponsorsToLogoItems(dbItems)
    : [];

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

      <LogoGrid logos={logos} />

      <Reveal delay={0.2}>
        <div className={styles.cta}>
          <p className={styles.ctaText}>Interested in sponsoring Triton Gaming?</p>
          <Link href="/sponsors" className={styles.ctaLink}>Learn More →</Link>
        </div>
      </Reveal>
    </section>
  );
}
