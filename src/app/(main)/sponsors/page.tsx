import type { Metadata } from 'next';
import LogoGrid from '@/components/LogoGrid/LogoGrid';
import { getContentBlock } from '@/lib/content';
import type { LogoItem } from '@/types';
import styles from './sponsors.module.css';

export const dynamic = 'force-dynamic';

const TIER_SIZE: Record<string, 'small' | 'medium' | 'large'> = {
  platinum: 'large', gold: 'large', silver: 'medium', bronze: 'small',
};

const OFFERINGS = [
  { icon: '🏟️', title: 'Event Activation', body: 'Set up booths, demos, and hands-on activations at our LANs, expos, and gaming events with thousands of student attendees.' },
  { icon: '🏆', title: 'Tournament Sponsorship', body: 'Co-host tournaments or provide prize pools — get your brand in front of competitive UCSD gamers and beyond.' },
  { icon: '📡', title: 'Social Media Reach', body: 'Reach 1.5M+ across our social channels with dedicated posts, stories, and reels featuring your brand and products.' },
  { icon: '🤝', title: 'Panels & Talks', body: 'Engage our community with an industry panel, career talk, or fireside chat connecting your team to future professionals.' },
];

export const metadata: Metadata = {
  title: 'Sponsors | Triton Gaming',
  description: 'Meet the sponsors that make Triton Gaming events possible.',
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
  let logos: LogoItem[] = [];

  try {
    const content = await getContentBlock('sponsors');
    const items = content.items as DbSponsor[] | undefined;
    if (items?.length) {
      logos = dbSponsorsToLogoItems(items);
    }
  } catch { /* fall through to empty */ }

  return (
    <div className={styles.page}>

      {/* Hero */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>PARTNERSHIPS</p>
          <h1 className={styles.heroTitle}>Backed by the Best</h1>
          <p className={styles.heroSub}>
            Triton Gaming partners with leading gaming brands to bring world-class experiences to UC San Diego students.
          </p>
        </div>
      </div>

      {/* Mission bar */}
      <div className={styles.missionBar}>
        <p>At Triton Gaming, community always comes first. Our sponsors make that possible.</p>
      </div>

      {/* Current sponsors */}
      <section className={styles.sponsorSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>CURRENT PARTNERS</p>
          <h2 className={styles.sectionTitle}>Our Sponsors</h2>
        </div>
        <div className={styles.grid}>
          <LogoGrid logos={logos} />
        </div>
      </section>

      {/* What we offer */}
      <section className={styles.offerSection}>
        <div className={styles.offerBg} aria-hidden="true" />
        <div className={styles.offerInner}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionLabelLight}>SPONSORSHIP BENEFITS</p>
            <h2 className={styles.sectionTitleLight}>What We Offer</h2>
            <p className={styles.sectionSub}>
              Innovative activations designed to connect your brand with UCSD&apos;s thriving gaming community.
            </p>
          </div>
          <div className={styles.offerGrid}>
            {OFFERINGS.map((o) => (
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
        <p className={styles.ctaHeading}>Interested in Sponsoring Triton Gaming?</p>
        <p className={styles.ctaSub}>Whatever you&apos;re envisioning — we&apos;ll make it happen.</p>
        <a
          href="mailto:tritongamingofficial@gmail.com"
          className={styles.ctaEmail}
        >
          tritongamingofficial@gmail.com
        </a>
      </section>

    </div>
  );
}
