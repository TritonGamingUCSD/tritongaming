import type { Metadata } from 'next';
import { resolveSections } from '@/lib/pageLayout';
import { Fragment } from 'react';
import { Building2, Trophy, RadioTower, Handshake } from 'lucide-react';
import LogoPlate from '@/components/LogoPlate/LogoPlate';
import { ZineBand, PageHero, BandHeader } from '@/components/ZineBand/ZineBand';
import { getContentBlocks } from '@/lib/content';
import type { LogoItem } from '@/types';
import PhotoStrip from '@/components/PhotoStrip/PhotoStrip';
import { getSitePhotos, pickPhotos } from '@/lib/sitePhotos';
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
  title: 'Sponsors',
  description: 'Meet the sponsors that make Triton Gaming events possible.',
  alternates: { canonical: '/sponsors' },
  openGraph: {
    title: 'Sponsors',
    description: 'Meet the sponsors that make Triton Gaming events possible.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sponsors',
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
  const sitePhotos = await getSitePhotos();
  const blocks = await getContentBlocks(['sponsors', 'page.sponsors', 'site.settings', 'layout.sponsors']);
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

  const sections: Record<string, React.ReactNode> = {
    mission: content.mission_text ? (
      <ZineBand tone="navy" edge={false} label="Mission">
        <p className={styles.mission}>{content.mission_text as string}</p>
      </ZineBand>
    ) : null,
    sponsors: (
      <ZineBand tone="ink" label="Current sponsors">
        <BandHeader label={(content.sponsors_label as string) || 'Current partners'} title={(content.sponsors_title as string) || 'Our sponsors'} />
        {logos.length > 0 ? (
          <ul className={styles.logoWall}>
            {logos.map((l, i) => {
              const plate = <LogoPlate src={l.logo.startsWith('/') || l.logo.startsWith('http') ? l.logo : `/${l.logo}`} alt={l.name} className={`${styles.plate} ${styles[`size_${l.size}`]}`} imgClassName={styles.logoImg} />;
              return (
                <li key={`${l.name}-${i}`}>
                  {l.link ? <a href={l.link} target="_blank" rel="noopener noreferrer nofollow" aria-label={l.name} className={styles.logoLink}>{plate}</a> : plate}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.noSponsors}>{(content.sponsors_empty as string) || 'Sponsor announcements coming soon.'}</p>
        )}
      </ZineBand>
    ),
    offer: (
      <ZineBand tone="navy" label="What we offer">
        <BandHeader label={content.offer_label as string} title={content.offer_title as string} sub={content.offer_subtitle as string} />
        <ul className={styles.offerGrid}>
          {offerings.map((o, i) => (
            <li key={o.title} className={`${styles.offerCard} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
              <span className={styles.offerIcon}>{o.icon}</span>
              <h3 className={styles.offerTitle}>{o.title}</h3>
              <p className={styles.offerBody}>{o.body}</p>
            </li>
          ))}
        </ul>
      </ZineBand>
    ),
    cta: (
      <ZineBand tone="deep" label="Contact">
        <div className={styles.cta}>
          <h2 className={styles.ctaHeading}>{content.cta_heading as string}</h2>
          <p className={styles.ctaSub}>{content.cta_sub as string}</p>
          <a href={`mailto:${email}`} className={styles.ctaEmail}>{email}</a>
        </div>
      </ZineBand>
    ),
  };
  const order = resolveSections('sponsors', blocks['layout.sponsors']?.sections);

  return (
    <div className={styles.page}>
      <PageHero label={content.hero_label as string} title={content.hero_title as string} sub={content.hero_subtitle as string} />
      {order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}
      <PhotoStrip tone="ink" caption={(content.strip_caption as string) || 'This is what your brand sits next to.'} photos={pickPhotos(sitePhotos, 3, 3)} />
    </div>
  );
}
