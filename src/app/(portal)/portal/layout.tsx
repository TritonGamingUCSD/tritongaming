import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import PortalSidebar from '@/components/portal/PortalSidebar';
import styles from './portal.module.css';

export const metadata = { title: 'Member Portal' };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect('/login?next=/portal');

  return (
    <div className={styles.layout}>
      <PortalSidebar profile={profile} />
      <main className={styles.main}>
        <div className={styles.topbar}>
          <Link href="/" className={styles.homeLink}>
            <Image src="/logos/tg_logo_multi.png" alt="TG" width={32} height={32} />
            <span>Back to Site</span>
          </Link>
        </div>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
