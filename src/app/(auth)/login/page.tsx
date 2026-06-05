import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getUser } from '@/lib/auth';
import LoginClient from './LoginClient';
import styles from './login.module.css';

export const metadata = { title: 'Sign In' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getUser();
  const params = await searchParams;

  if (user) redirect(params.next || '/portal');

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoSection}>
          <Image
            src="/logos/tg_logo_multi.png"
            alt="Triton Gaming"
            width={80}
            height={80}
            className={styles.logo}
            priority
          />
          <h1 className={styles.title}>Triton Gaming</h1>
          <p className={styles.subtitle}>Member Portal</p>
        </div>

        <div className={styles.divider} />

        {params.error && (
          <div className={styles.errorBanner}>
            Authentication failed. Please try again.
          </div>
        )}

        <p className={styles.prompt}>Sign in to access events, tickets, and the community board.</p>

        <LoginClient next={params.next} />

        <p className={styles.footnote}>
          Password login coming soon. Currently accepting Google accounts.
        </p>
      </div>

      <div className={styles.bgGlow} aria-hidden="true" />
    </div>
  );
}
