import type { Metadata } from 'next';
import { resolveSections } from '@/lib/site/pageLayout';
import { Fragment } from 'react';
import LogoPlate from '@/components/LogoPlate/LogoPlate';
import { ZineBand, PageHero, BandHeader } from '@/components/ZineBand/ZineBand';
import { Percent } from 'lucide-react';
import { getContentBlocks } from '@/lib/site/content';
import PhotoStrip from '@/components/PhotoStrip/PhotoStrip';
import { getSitePhotos, pickPhotos } from '@/lib/storage/sitePhotos';
import styles from './membership.module.css';

// Served from the CDN cache and refreshed in the background — data comes from
// the cached fetchers in lib/ (revalidated on save), not per-request queries.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Membership',
  description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
  alternates: { canonical: '/membership' },
  openGraph: {
    title: 'Membership',
    description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Membership',
    description: 'Get the Triton Gaming membership card and save at local partner spots all year long.',
  },
};

type Partner = { name?: string; discount?: string; logo_url?: string };

export default async function MembershipPage() {
  const sitePhotos = await getSitePhotos();
  const blocks = await getContentBlocks(['page.membership', 'membership.partners', 'layout.membership']);
  const content = blocks['page.membership'] ?? {};
  const partnersContent = blocks['membership.partners'] ?? {};

  const partners = ((partnersContent.items as Partner[] | undefined) ?? [])
    .filter((p) => p.name);

  const sections: Record<string, React.ReactNode> = {
    price: content.price || content.validity ? (
      <ZineBand tone="navy" edge={false} label="Price">
        {/* the card itself, drawn as the object you get */}
        <div className={styles.card}>
          <span className={styles.cardKicker}>Member card</span>
          {content.price ? <span className={styles.cardPrice}>{content.price as string}</span> : null}
          {content.validity ? <span className={styles.cardValidity}>{content.validity as string}</span> : null}
          <span className={styles.cardStripe} aria-hidden="true" />
        </div>
      </ZineBand>
    ) : null,
    intro: content.intro_text || content.purchase_url ? (
      <ZineBand tone="ink" label="About the card">
        <div className={styles.intro}>
          {content.intro_text ? <p className={styles.introText}>{content.intro_text as string}</p> : null}
          {content.purchase_url ? (
            <a href={content.purchase_url as string} target="_blank" rel="noopener noreferrer" className={styles.purchaseBtn}>
              {(content.purchase_cta as string) || 'Get your card'} <span aria-hidden="true">→</span>
            </a>
          ) : null}
        </div>
      </ZineBand>
    ) : null,
    partners: (
      <ZineBand tone="deep" label="Partner discounts">
        <BandHeader label={(content.partners_label as string) || 'Where to use it'} title={(content.partners_title as string) || 'Partner discounts'} />
        {partners.length > 0 ? (
          <ul className={styles.partnersGrid}>
            {partners.map((p, i) => (
              <li key={`${p.name}-${i}`} className={`${styles.partnerCard} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
                {p.logo_url ? (
                  <LogoPlate src={p.logo_url} alt={p.name || ''} className={styles.plate} imgClassName={styles.partnerLogo} />
                ) : (
                  <span className={styles.partnerIcon}><Percent size={22} strokeWidth={1.75} aria-hidden="true" /></span>
                )}
                <h3 className={styles.partnerName}>{p.name}</h3>
                {p.discount && <p className={styles.partnerDiscount}>{p.discount}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.noPartners}>{(content.partners_empty as string) || 'Partner announcements coming soon.'}</p>
        )}
      </ZineBand>
    ),
  };
  const order = resolveSections('membership', blocks['layout.membership']?.sections);

  return (
    <div className={styles.page}>
      <PageHero label={(content.hero_label as string) || 'Membership cards'} title={(content.hero_title as string) || 'Triton Gaming membership card'} sub={content.hero_subtitle as string} />
      {order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}
      <PhotoStrip tone="ink" caption={(content.strip_caption as string) || 'The places and people behind the card.'} photos={pickPhotos(sitePhotos, 0, 2)} />
    </div>
  );
}
