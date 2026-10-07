import type { Metadata } from 'next';
import { resolveSections } from '@/lib/site/pageLayout';
import { Fragment } from 'react';
import Image from 'next/image';
import { Gamepad2, Calendar, Users, Building2 } from 'lucide-react';
import { getContentBlocks } from '@/lib/site/content';
import { ZineBand, PageHero, BandHeader } from '@/components/ZineBand/ZineBand';
import PhotoStrip from '@/components/PhotoStrip/PhotoStrip';
import { getSitePhotos, pickPhotos } from '@/lib/storage/sitePhotos';
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

// Served from the CDN cache and refreshed in the background — data comes from
// the cached fetchers in lib/ (revalidated on save), not per-request queries.
export const revalidate = 300;

// Icon and accent color are a design/brand choice (Discord and Instagram's
// own logos), not copy — title/body/cta/href for each card come from the
// page.get-involved content block instead.
const WAY_ICONS = [
  <Image key="1" src="/logos/discord.svg" alt="" width={28} height={28} unoptimized />,
  <Image key="2" src="/logos/instagram.svg" alt="" width={28} height={28} unoptimized />,
  <Gamepad2 key="3" size={28} strokeWidth={1.5} aria-hidden="true" />,
];

export default async function GetInvolvedPage() {
  const sitePhotos = await getSitePhotos();
  const blocks = await getContentBlocks(['page.get-involved', 'page.get-involved.officer', 'layout.get-involved']);
  const content = blocks['page.get-involved'] ?? {};
  const officer = blocks['page.get-involved.officer'] ?? {};

  const flyerUrl = officer.recruitment_flyer_url as string | undefined;
  const ways = WAY_ICONS.map((icon, i) => ({
    icon,
    title: content[`way${i + 1}_title`] as string,
    body: content[`way${i + 1}_body`] as string,
    cta: content[`way${i + 1}_cta`] as string,
    href: content[`way${i + 1}_href`] as string,
  }));
  const perks = (Array.isArray(officer.perks) ? officer.perks as string[] : [])?.filter(Boolean);

  const metas = [
    { icon: <Calendar size={20} strokeWidth={1.75} aria-hidden="true" />, label: officer.stat1_label, value: officer.stat1_value },
    { icon: <Users size={20} strokeWidth={1.75} aria-hidden="true" />, label: officer.stat2_label, value: officer.stat2_value },
    { icon: <Building2 size={20} strokeWidth={1.75} aria-hidden="true" />, label: officer.stat3_label, value: officer.stat3_value },
  ] as { icon: React.ReactNode; label?: string; value?: string }[];

  const sections: Record<string, React.ReactNode> = {
    ways: (
      <ZineBand tone="navy" edge={false} label="Ways to connect">
        <BandHeader label={content.ways_label as string} title={content.ways_title as string} />
        <ul className={styles.waysGrid}>
          {ways.map((w, i) => (
            <li key={w.title} className={`${styles.wayCard} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
              <span className={styles.wayIcon}>{w.icon}</span>
              <h3 className={styles.wayTitle}>{w.title}</h3>
              <p className={styles.wayBody}>{w.body}</p>
              <a
                href={w.href}
                className={styles.wayCta}
                target={w.href.startsWith('http') ? '_blank' : undefined}
                rel={w.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {w.cta} <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>
      </ZineBand>
    ),
    officer: (
      <ZineBand tone="ink" label="Become an officer">
        <div className={styles.officer}>
          <div className={styles.officerText}>
            <BandHeader label={officer.label as string} title={officer.title as string} />
            <p className={styles.officerBody}>{officer.body as string}</p>
            <ul className={styles.perkList}>
              {perks.map((perk) => (
                <li key={perk} className={styles.perkItem}><span className={styles.perkDot} aria-hidden="true">▸</span> {perk}</li>
              ))}
            </ul>
            {officer.applications_closed ? (
              <div className={styles.closedNote} role="status">
                <strong className={styles.closedTitle}>Applications closed right now</strong>
                <span>{(officer.closed_message as string) || 'Applications are closed right now. Follow our Discord and Instagram to hear when they reopen.'}</span>
              </div>
            ) : (
              <a href={officer.apply_href as string} target="_blank" rel="noopener noreferrer" className={styles.applyBtn}>
                {(officer.apply_text as string) || 'Apply now'} <span aria-hidden="true">→</span>
              </a>
            )}
          </div>
          <div className={styles.officerMeta}>
            {flyerUrl && (
              <figure className={styles.flyer}>
                <span className={styles.tape} aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flyerUrl} alt="Officer recruitment flyer" className={styles.flyerImg} />
              </figure>
            )}
            <ul className={styles.metaList}>
              {metas.map((m, i) => (
                <li key={i} className={styles.metaCard}>
                  <span className={styles.metaIcon}>{m.icon}</span>
                  <span className={styles.metaLabel}>{m.label}</span>
                  <span className={styles.metaValue}>{m.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ZineBand>
    ),
  };
  const order = resolveSections('get-involved', blocks['layout.get-involved']?.sections);

  return (
    <div className={styles.page}>
      <PageHero label={content.hero_label as string} title={content.hero_title as string} sub={content.hero_subtitle as string} />
      {order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}
      <PhotoStrip tone="navy" caption={(content.strip_caption as string) || 'Come as you are. Leave with a team.'} photos={pickPhotos(sitePhotos, 0, 3)} />
    </div>
  );
}
