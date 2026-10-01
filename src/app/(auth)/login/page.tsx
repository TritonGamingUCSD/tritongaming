import Notice from '@/components/ui/Notice';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import LoginClient from './LoginClient';
import styles from './login.module.css';

export const metadata = { title: 'Sign In' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; ref?: string }>;
}) {
  const user = await getUser();
  const params = await searchParams;

  if (user) redirect(params.next || '/portal');

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.backLink}>← Back to Site</Link>

      <div className={styles.card}>
        <div className={styles.logoSection}>
          <Image
            src="/logos/tg_logo.png"
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
          <Notice tone="error">Authentication failed. Please try again.</Notice>
        )}

        <p className={styles.prompt}>Sign in to access events and tickets.</p>
        <p className={styles.ucsdHint}>UCSD student? Sign in with your @ucsd.edu Google account to get verified access.</p>

        <LoginClient next={params.next} ref={params.ref} />

        <p className={styles.footnote}>
          Losing access to this Google account someday? Link another one from your Profile page
          so you can still sign in with it.
        </p>
      </div>

      <div className={styles.bgGlow} aria-hidden="true" />
    </div>
  );
}
