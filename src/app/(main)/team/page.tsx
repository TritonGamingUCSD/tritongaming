import { getOffSwitches } from '@/lib/portal/featureServer';
import type { Metadata } from 'next';
import BoardSection from '@/components/BoardSection/BoardSection';
import { getContentBlock } from '@/lib/site/content';
import { getBoardMembers } from './getBoardMembers';
import { getTeamYears } from './getTeamYears';
import { PageHero } from '@/components/ZineBand/ZineBand';
import PhotoStrip from '@/components/PhotoStrip/PhotoStrip';
import { getSitePhotos, pickPhotos } from '@/lib/storage/sitePhotos';
import { ZineBand, BandHeader } from '@/components/ZineBand/ZineBand';
import { getDivisions, divisionLogoSrc } from '@/lib/members/divisions';
import { getDivisionHeads } from '@/lib/divisions/heads';
import Image from 'next/image';
import Link from 'next/link';
import styles from './team.module.css';

export const metadata: Metadata = {
  title: 'Team',
  description: "Meet Triton Gaming's executive board, leads, and officers.",
  alternates: { canonical: '/team' },
  openGraph: {
    title: 'Team',
    description: "Meet Triton Gaming's executive board, leads, and officers.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Team',
    description: "Meet Triton Gaming's executive board, leads, and officers.",
  },
};

// Served from the CDN cache and refreshed in the background — data comes from
// the cached fetchers in lib/ (revalidated on save), not per-request queries.
export const revalidate = 3600;

export default async function TeamPage() {
  const sitePhotos = await getSitePhotos();
  const [boardMembers, years, content, divisions, heads] = await Promise.all([
    getBoardMembers(),
    getTeamYears(),
    getContentBlock('page.about'),
    getDivisions(),
    getDivisionHeads(),
  ]);
  const label = content.label as string;
  const title = content.title as string;
  const subtitle = content.subtitle as string;

  return (
    <div className={styles.page}>
      <PageHero label={label} title={title} sub={subtitle} />
      <BoardSection members={boardMembers} years={years} />
      {divisions.length > 0 && !(await getOffSwitches()).includes('div_public_pages') && (
        <ZineBand tone="navy" label="Divisions">
          <BandHeader label="Game by game" title="Our Divisions" sub="Each division has its own Heads and its own page." />
          <ul className={styles.divGrid}>
            {divisions.map((d, i) => {
              const logo = divisionLogoSrc(d.logo_url);
              const names = heads.find((h) => h.divisionId === d.id)?.heads ?? [];
              return (
                <li key={d.id}>
                  <Link href={`/${d.slug}`} className={`${styles.divCard} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
                    {logo ? <Image src={logo} alt="" width={52} height={52} unoptimized className={styles.divLogo} /> : <span className={styles.divLetter}>{d.name[0]}</span>}
                    <span>
                      <strong>{d.name}</strong>
                      <small>{names.length ? `Led by ${names.map((n) => n.name).join(', ')}` : 'Division'}</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </ZineBand>
      )}
      <PhotoStrip tone="ink" caption={(content.strip_caption as string) || 'The people on the other side of the screen.'} photos={pickPhotos(sitePhotos, 2, 3)} />
    </div>
  );
}
