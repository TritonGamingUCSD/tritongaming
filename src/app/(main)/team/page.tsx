import type { Metadata } from 'next';
import BoardSection from '@/components/BoardSection/BoardSection';
import { getContentBlock } from '@/lib/site/content';
import { getBoardMembers } from './getBoardMembers';
import { getTeamYears } from './getTeamYears';
import { PageHero } from '@/components/ZineBand/ZineBand';
import PhotoStrip from '@/components/PhotoStrip/PhotoStrip';
import { getSitePhotos, pickPhotos } from '@/lib/storage/sitePhotos';
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
export const revalidate = 300;

export default async function TeamPage() {
  const sitePhotos = await getSitePhotos();
  const [boardMembers, years, content] = await Promise.all([
    getBoardMembers(),
    getTeamYears(),
    getContentBlock('page.about'),
  ]);
  const label = content.label as string;
  const title = content.title as string;
  const subtitle = content.subtitle as string;

  return (
    <div className={styles.page}>
      <PageHero label={label} title={title} sub={subtitle} />
      <BoardSection members={boardMembers} years={years} />
      <PhotoStrip tone="ink" caption={(content.strip_caption as string) || 'The people on the other side of the screen.'} photos={pickPhotos(sitePhotos, 2, 3)} />
    </div>
  );
}
