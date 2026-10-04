import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getDivisions, divisionLogoSrc } from '@/lib/divisions';
import { getContentBlock } from '@/lib/content';
import { markdownToDescription } from '@/lib/markdown';
import LogoPlate from '@/components/LogoPlate/LogoPlate';
import { ZineBand, PageHero } from '@/components/ZineBand/ZineBand';
import PhotoStrip from '@/components/PhotoStrip/PhotoStrip';
import { getSitePhotos, pickPhotos } from '@/lib/sitePhotos';
import styles from './divisions.module.css';

const DESCRIPTION = 'Triton Gaming hosts dedicated game divisions — from competitive gaming to casual communities. Find your squad.';

export const metadata: Metadata = {
  title: 'Divisions',
  description: DESCRIPTION,
  alternates: { canonical: '/divisions' },
  openGraph: {
    title: 'Divisions',
    description: DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Divisions',
    description: DESCRIPTION,
  },
};
export const revalidate = 60;

export default async function DivisionsPage() {
  const sitePhotos = await getSitePhotos();
  const [divisions, content] = await Promise.all([
    getDivisions(),
    getContentBlock('page.divisions'),
  ]);

  return (
    <div className={styles.page}>
      <PageHero label={(content.label as string) || 'Find your squad'} title={content.title as string} sub={content.subtitle as string} />

      <ZineBand tone="navy" edge={false} label="Divisions">
        {divisions.length > 0 ? (
          <ul className={styles.grid}>
            {divisions.map((div, i) => {
              const logoSrc = divisionLogoSrc(div.logo_url);
              const pitch = div.description ? markdownToDescription(div.description, 120) : '';
              return (
                <li key={div.id} className={`${styles.card} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
                  <div className={styles.badge}>
                    {logoSrc ? (
                      <LogoPlate src={logoSrc} alt="" className={styles.plate} imgClassName={styles.logo} />
                    ) : (
                      <span className={styles.logoFallback} aria-hidden="true">{div.name[0]}</span>
                    )}
                  </div>
                  <h2 className={styles.divName}>{div.name}</h2>
                  <p className={styles.divDesc}>{pitch || 'Check the page for what this division is up to.'}</p>
                  <div className={styles.cardFooter}>
                    <span className={styles.learnMore}>{(content.learn_more as string) || 'Learn more'} <span aria-hidden="true">→</span></span>
                    {div.discord_url && (
                      <a href={div.discord_url} target="_blank" rel="noopener noreferrer" className={styles.discordBtn} aria-label={`Join ${div.name}'s Discord`}>
                        <Image src="/logos/discord.svg" alt="" width={14} height={14} unoptimized /> Discord
                      </a>
                    )}
                  </div>
                  {/* Stretched link: the whole card opens the division; the Discord button sits above it. */}
                  <Link href={`/divisions/${div.slug}`} className={styles.cardLink} aria-label={`View ${div.name}`} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.noContent}>{(content.empty as string) || 'No divisions yet. Check back soon!'}</p>
        )}
      </ZineBand>
      <PhotoStrip tone="ink" caption={(content.strip_caption as string) || 'Every division, in the same room.'} photos={pickPhotos(sitePhotos, 1, 3)} />
    </div>
  );
}
