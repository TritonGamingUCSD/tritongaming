import type { Metadata } from 'next';
import Image from 'next/image';
import { Gamepad2, Calendar, Users, Building2 } from 'lucide-react';
import { getContentBlocks } from '@/lib/content';
import styles from './get-involved.module.css';

export const metadata: Metadata = {
  title: 'Get Involved',
  description: 'Join Triton Gaming — connect on Discord, follow us on Instagram, or become an officer.',
  alternates: { canonical: '/get-involved' },
  openGraph: {
    title: 'Get Involved',
    description: 'Join Triton Gaming — connect on Discord, follow us on Instagram, or become an officer.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get Involved',
    description: 'Join Triton Gaming — connect on Discord, follow us on Instagram, or become an officer.',
  },
};

export const dynamic = 'force-dynamic';

// Icon and accent color are a design/brand choice (Discord and Instagram's
// own logos), not copy — title/body/cta/href for each card come from the
// page.get-involved content block instead.
const WAY_ICONS = [
  <Image key="1" src="/logos/discord.svg" alt="" width={28} height={28} unoptimized />,
  <Image key="2" src="/logos/instagram.svg" alt="" width={28} height={28} unoptimized />,
  <Gamepad2 key="3" size={28} strokeWidth={1.5} aria-hidden="true" />,
];
const WAY_ACCENTS = ['blue', 'yellow', 'blue'];

export default async function GetInvolvedPage() {
  const blocks = await getContentBlocks(['page.get-involved', 'page.get-involved.officer']);
  const content = blocks['page.get-involved'] ?? {};
  const officer = blocks['page.get-involved.officer'] ?? {};

  const flyerUrl = officer.recruitment_flyer_url as string | undefined;
  const ways = WAY_ICONS.map((icon, i) => ({
    icon,
    accent: WAY_ACCENTS[i],
    title: content[`way${i + 1}_title`] as string,
    body: content[`way${i + 1}_body`] as string,
    cta: content[`way${i + 1}_cta`] as string,
    href: content[`way${i + 1}_href`] as string,
  }));
  const perks = (Array.isArray(officer.perks) ? officer.perks as string[] : [])?.filter(Boolean);

  return (
    <div className={styles.page}>

      {/* Hero banner */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>{content.hero_label as string}</p>
          <h1 className={styles.heroTitle}>{content.hero_title as string}</h1>
          <p className={styles.heroSub}>{content.hero_subtitle as string}</p>
        </div>
      </div>

      {/* Ways to connect */}
      <section className={styles.waysSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>{content.ways_label as string}</p>
          <h2 className={styles.sectionTitle}>{content.ways_title as string}</h2>
        </div>
        <div className={styles.waysGrid}>
          {ways.map((w) => (
            <div key={w.title} className={`${styles.wayCard} ${styles[`accent_${w.accent}`]}`}>
              <div className={styles.wayEmoji}>{w.icon}</div>
              <h3 className={styles.wayTitle}>{w.title}</h3>
              <p className={styles.wayBody}>{w.body}</p>
              <a
                href={w.href}
                className={styles.wayCta}
                target={w.href.startsWith('http') ? '_blank' : undefined}
                rel={w.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {w.cta} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Officer application */}
      <section className={styles.officerSection}>
        <div className={styles.officerBg} aria-hidden="true" />
        <div className={styles.officerContent}>
          <div className={styles.officerText}>
            <p className={styles.sectionLabel}>{officer.label as string}</p>
            <h2 className={styles.officerTitle}>{officer.title as string}</h2>
            <p className={styles.officerBody}>{officer.body as string}</p>
            <ul className={styles.perkList}>
              {perks.map((perk) => (
                <li key={perk} className={styles.perkItem}>
                  <span className={styles.perkDot}>▸</span> {perk}
                </li>
              ))}
            </ul>
            <a
              href={officer.apply_href as string}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.applyBtn}
            >
              Apply Now
            </a>
          </div>
          <div className={styles.officerMeta}>
            {flyerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flyerUrl} alt="Officer recruitment flyer" className={styles.recruitmentFlyer} />
            )}
            <div className={styles.metaCard}>
              <span className={styles.metaEmoji}><Calendar size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <span className={styles.metaLabel}>{officer.stat1_label as string}</span>
              <span className={styles.metaValue}>{officer.stat1_value as string}</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaEmoji}><Users size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <span className={styles.metaLabel}>{officer.stat2_label as string}</span>
              <span className={styles.metaValue}>{officer.stat2_value as string}</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaEmoji}><Building2 size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <span className={styles.metaLabel}>{officer.stat3_label as string}</span>
              <span className={styles.metaValue}>{officer.stat3_value as string}</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
