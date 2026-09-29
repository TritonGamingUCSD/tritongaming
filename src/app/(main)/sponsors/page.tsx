import type { Metadata } from 'next';
import { Building2, Trophy, RadioTower, Handshake } from 'lucide-react';
import LogoGrid from '@/components/LogoGrid/LogoGrid';
import { getContentBlocks } from '@/lib/content';
import type { LogoItem } from '@/types';
import styles from './sponsors.module.css';

export const dynamic = 'force-dynamic';

const TIER_SIZE: Record<string, 'small' | 'medium' | 'large'> = {
  platinum: 'large', gold: 'large', silver: 'medium', bronze: 'small',
};

// Icons are a design choice tied to what each offering *is*, not copy — the
// title/body text next to them comes from the page.sponsors content block.
const OFFERING_ICONS = [
  <Building2 key="1" size={28} strokeWidth={1.5} aria-hidden="true" />,
  <Trophy key="2" size={28} strokeWidth={1.5} aria-hidden="true" />,
  <RadioTower key="3" size={28} strokeWidth={1.5} aria-hidden="true" />,
  <Handshake key="4" size={28} strokeWidth={1.5} aria-hidden="true" />,
];

export const metadata: Metadata = {
  title: 'Sponsors | Triton Gaming',
  description: 'Meet the sponsors that make Triton Gaming events possible.',
  alternates: { canonical: '/sponsors' },
  openGraph: {
    title: 'Sponsors | Triton Gaming',
    description: 'Meet the sponsors that make Triton Gaming events possible.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sponsors | Triton Gaming',
    description: 'Meet the sponsors that make Triton Gaming events possible.',
  },
};

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

export default async function SponsorsPage() {
  const blocks = await getContentBlocks(['sponsors', 'page.sponsors', 'site.settings']);
  const sponsorsContent = blocks['sponsors'] ?? {};
  const content = blocks['page.sponsors'] ?? {};
  const settings = blocks['site.settings'] ?? {};

  const items = sponsorsContent.items as DbSponsor[] | undefined;
  const logos: LogoItem[] = items?.length ? dbSponsorsToLogoItems(items) : [];

  // site.settings.email is genuinely optional (see content-blocks.ts) — this
  // one stays as a real fallback, not stand-in copy, since a club contact
  // email not being configured yet is a legitimate state, unlike page copy.
  const email = (settings.email as string) || 'tritongamingofficial@gmail.com';
  const offerings = OFFERING_ICONS.map((icon, i) => ({
    title: content[`offer${i + 1}_title`] as string,
    body: content[`offer${i + 1}_body`] as string,
    icon,
  }));

  return (
    <div className={styles.page}>

      {/* Hero */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>{content.hero_label as string}</p>
          <h1 className={styles.heroTitle}>{content.hero_title as string}</h1>
          <p className={styles.heroSub}>{content.hero_subtitle as string}</p>
        </div>
      </div>

      {/* Mission bar */}
      <div className={styles.missionBar}>
        <p>{content.mission_text as string}</p>
      </div>

      {/* Current sponsors */}
      <section className={styles.sponsorSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>CURRENT PARTNERS</p>
          <h2 className={styles.sectionTitle}>Our Sponsors</h2>
        </div>
        {logos.length > 0 ? (
          <div className={styles.grid}>
            <LogoGrid logos={logos} />
          </div>
        ) : (
          <p className={styles.noSponsors}>Sponsor announcements coming soon.</p>
        )}
      </section>

      {/* What we offer */}
      <section className={styles.offerSection}>
        <div className={styles.offerBg} aria-hidden="true" />
        <div className={styles.offerInner}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionLabelLight}>{content.offer_label as string}</p>
            <h2 className={styles.sectionTitleLight}>{content.offer_title as string}</h2>
            <p className={styles.sectionSub}>{content.offer_subtitle as string}</p>
          </div>
          <div className={styles.offerGrid}>
            {offerings.map((o) => (
              <div key={o.title} className={styles.offerCard}>
                <span className={styles.offerIcon}>{o.icon}</span>
                <h3 className={styles.offerTitle}>{o.title}</h3>
                <p className={styles.offerBody}>{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className={styles.ctaSection}>
        <p className={styles.ctaHeading}>{content.cta_heading as string}</p>
        <p className={styles.ctaSub}>{content.cta_sub as string}</p>
        <a
          href={`mailto:${email}`}
          className={styles.ctaEmail}
        >
          {email}
        </a>
      </section>

    </div>
  );
}
