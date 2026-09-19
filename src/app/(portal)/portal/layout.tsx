import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import PortalTopbar from '@/components/portal/PortalTopbar';
import ConnectivityBanner from '@/components/ConnectivityBanner/ConnectivityBanner';
import styles from './portal.module.css';

export const metadata = { title: 'Member Portal' };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect('/login?next=/portal');

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <PortalTopbar />
        <div className={styles.content}>{children}</div>
      </main>
      <ConnectivityBanner />
    </div>
  );
}
