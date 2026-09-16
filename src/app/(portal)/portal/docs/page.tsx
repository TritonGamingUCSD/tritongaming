import { redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import DocsClient from './DocsClient';
import { getDocsData } from './getDocsData';
import styles from './docs-page.module.css';

export const metadata = { title: 'Documentation' };
export const dynamic = 'force-dynamic';

export default async function DocsPage() {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile || !hasCapability(roles, 'manage_docs')) redirect('/portal');

  const { docs, categories } = await getDocsData();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Documentation</h1>
          <p className={styles.sub}>
            How-to guides and reference docs for officers, leads, and execs — write it once, everyone can find it here.
          </p>
        </div>
      </div>

      <DocsClient initialDocs={docs} initialCategories={categories} userId={profile.id} />
    </div>
  );
}
