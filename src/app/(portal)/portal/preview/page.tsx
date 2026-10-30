import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/core/auth';
import PortalThemeToggle from '@/components/portal/PortalThemeToggle';
import { PREVIEWS } from './catalog';
import styles from './preview.module.css';

export const metadata = { title: 'Previews' };
export const dynamic = 'force-dynamic';

// A list of every screen and animation that can be previewed. Not linked from any menu; any signed-in member can open it.
export default async function PreviewIndex() {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent('/portal/preview')}`);
  const groups = [...new Set(PREVIEWS.map((p) => p.group))];
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Previews</h1>
        <PortalThemeToggle labelled />
      </div>
      <p className={styles.note}>Every screen and animation that can be played here, with sample data. Nothing is saved and nobody is notified.</p>
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
