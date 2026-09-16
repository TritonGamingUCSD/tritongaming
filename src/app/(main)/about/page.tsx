import type { Metadata } from 'next';
import BoardSection from '@/components/BoardSection/BoardSection';
import { getBoardMembers } from './getBoardMembers';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About | Triton Gaming',
  description: "Meet Triton Gaming's executive board, leads, and officers.",
};

export default async function AboutPage() {
  const boardMembers = await getBoardMembers();

  return (
    <div className={styles.page}>
      <div className={styles.heroBanner}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>THE PEOPLE BEHIND TG</p>
          <h1 className={styles.heroTitle}>Meet the Team</h1>
          <p className={styles.heroSub}>
            The board, leads, and officers who plan, build, and run Triton Gaming.
          </p>
        </div>
      </div>
      <BoardSection members={boardMembers} />
    </div>
  );
}
