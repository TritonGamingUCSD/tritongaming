import type { Metadata } from 'next';
import { resolveSections } from '@/lib/pageLayout';
import { Fragment } from 'react';
import Image from 'next/image';
import { Percent } from 'lucide-react';
import { getContentBlocks } from '@/lib/content';
import styles from './membership.module.css';

// Served from the CDN cache and refreshed in the background — data comes from
// the cached fetchers in lib/ (revalidated on save), not per-request queries.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Membership Card',
  description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
  alternates: { canonical: '/membership' },
  openGraph: {
    title: 'Membership Card',
    description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Membership Card',
    description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
  },
};

type Partner = { name?: string; discount?: string; logo_url?: string };

export default async function MembershipPage() {
  const blocks = await getContentBlocks(['page.membership', 'membership.partners', 'layout.membership']);
  const content = blocks['page.membership'] ?? {};
  const partnersContent = blocks['membership.partners'] ?? {};

  const partners = ((partnersContent.items as Partner[] | undefined) ?? [])
    .filter((p) => p.name);

  const sections: Record<string, React.ReactNode> = {
    price: (
      <>
{/* Price / validity bar */}
      <div className={styles.priceBar}>
        {content.price ? <span className={styles.priceValue}>{content.price as string}</span> : null}
        {content.validity ? <span className={styles.priceValidity}>{content.validity as string}</span> : null}
      </div>
      </>
    ),
    intro: (
      <>
{/* Intro + purchase CTA */}
      <section className={styles.introSection}>
        {content.intro_text ? <p className={styles.introText}>{content.intro_text as string}</p> : null}
        {content.purchase_url ? (
          <a
            href={content.purchase_url as string}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.purchaseBtn}
          >
            {(content.purchase_cta as string) || 'Get Your Card'}
          </a>
        ) : null}
      </section>
      </>
    ),
    partners: (
      <>
{/* Partner discounts */}
      <section className={styles.partnersSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>{(content.partners_label as string) || 'WHERE TO USE IT'}</p>
          <h2 className={styles.sectionTitle}>{(content.partners_title as string) || 'Partner Discounts'}</h2>
        </div>
        {partners.length > 0 ? (
          <div className={styles.partnersGrid}>
            {partners.map((p, i) => (
              <div key={`${p.name}-${i}`} className={styles.partnerCard}>
                {p.logo_url ? (
                  <Image src={p.logo_url} alt={p.name || ''} width={240} height={168} className={styles.partnerLogo} unoptimized />
                ) : (
                  <span className={styles.partnerIcon}><Percent size={20} strokeWidth={1.5} aria-hidden="true" /></span>
                )}
                <h3 className={styles.partnerName}>{p.name}</h3>
                {p.discount && <p className={styles.partnerDiscount}>{p.discount}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noPartners}>{(content.partners_empty as string) || 'Partner announcements coming soon.'}</p>
        )}
      </section>
      </>
    ),
  };
  const order = resolveSections('membership', blocks['layout.membership']?.sections);

  return (
    <div className={styles.page}>

      {/* Hero */}
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>{(content.hero_label as string) || 'MEMBERSHIP CARDS'}</p>
          <h1 className={styles.heroTitle}>{(content.hero_title as string) || 'Triton Gaming Membership Card'}</h1>
          <p className={styles.heroSub}>{content.hero_subtitle as string}</p>
        </div>
      </div>

      {order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}
    </div>
  );
}
