import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import styles from './division.module.css';

export const metadata = { title: 'My Division' };

export default async function MyDivisionPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'lead')) redirect('/portal');

  if (!profile.division_id) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>My Division</h1>
        <div className={styles.noDivision}>
          <p>You are not assigned to a division yet.</p>
          <p>Contact an admin to get assigned as a division lead.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Division</h1>
      <p className={styles.desc}>
        Manage your division page and roster. Your changes will be visible on the{' '}
        <Link href="/divisions" className={styles.link}>Divisions</Link> page.
      </p>

      <div className={styles.actions}>
        <Link href={`/divisions`} className={styles.actionCard}>
          <span>🎮</span>
          <div>
            <div className={styles.actionTitle}>View Division Page</div>
            <div className={styles.actionDesc}>See how your division page looks to the public</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
