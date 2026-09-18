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

// A compact strip, not a full section — the dedicated /sponsors page is
// where this content gets room to breathe; here it's just a "trusted by"
// beat between Divisions and the closing recruitment section.
export default async function LandingSponsors() {
  const [sponsorsContent, sectionContent] = await Promise.all([
    getContentBlock('sponsors'),
    getContentBlock('homepage.sponsors'),
  ]);
  const dbItems = sponsorsContent.items as DbSponsor[] | undefined;
  const logos: LogoItem[] = dbItems?.length
    ? dbSponsorsToLogoItems(dbItems)
    : [];
  const label = sectionContent.label as string;

  if (logos.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Sponsors">
      <Reveal variant="fadeUp">
        <div className={styles.strip}>
          <div className={styles.stripHeader}>
            <p className={styles.sectionLabel}>{label}</p>
            <Link href="/sponsors" className={styles.ctaLink}>Become a Sponsor →</Link>
          </div>
          <LogoGrid logos={logos} />
        </div>
      </Reveal>
    </section>
  );
}
