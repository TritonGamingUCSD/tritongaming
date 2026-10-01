import type { Metadata } from 'next';
import BoardSection from '@/components/BoardSection/BoardSection';
import { getContentBlock } from '@/lib/content';
import { getBoardMembers } from './getBoardMembers';
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

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const [boardMembers, content] = await Promise.all([
    getBoardMembers(),
    getContentBlock('page.about'),
  ]);
  const label = content.label as string;
  const title = content.title as string;
  const subtitle = content.subtitle as string;

  return (
    <div className={styles.page}>
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>{label}</p>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroSub}>{subtitle}</p>
        </div>
      </div>
      <BoardSection members={boardMembers} />
    </div>
  );
}
