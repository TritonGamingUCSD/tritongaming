import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getProfile, getUserRoles } from '@/lib/core/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import PortalThemeToggle from '@/components/portal/PortalThemeToggle';
import { PREVIEWS } from './catalog';
import CodeStyleSwitch from './CodeStyleSwitch';
import styles from './preview.module.css';

export const metadata = { title: 'Previews' };
export const dynamic = 'force-dynamic';

// A list of every screen and animation that can be previewed. Not linked from any menu, and only for Admins (anyone else gets the same page as for an address that does not exist).
export default async function PreviewIndex() {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) redirect(`/login?next=${encodeURIComponent('/portal/preview')}`);
  if (!hasCapability(roles, 'view_admin_dashboard')) notFound();
  const groups = [...new Set(PREVIEWS.map((p) => p.group))];
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Previews</h1>
        <PortalThemeToggle labelled />
      </div>
      <p className={styles.note}>Every screen and animation that can be played here, with sample data. Nothing is saved and nobody is notified.</p>
      <CodeStyleSwitch />
      {groups.map((g) => (
        <section key={g} className={styles.group}>
          <h2>{g}</h2>
          <ul className={styles.list}>
            {PREVIEWS.filter((p) => p.group === g).map((p) => (
              <li key={p.slug}>
                <Link href={`/portal/preview/${p.slug}`} className={styles.item}>
                  <strong>{p.title}</strong>
                  <span>{p.about}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
