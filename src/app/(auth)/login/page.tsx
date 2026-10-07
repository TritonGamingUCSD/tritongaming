import Notice from '@/components/ui/Notice';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import LoginClient from './LoginClient';
import styles from './login.module.css';
import type { Metadata } from 'next';
import { portalTargetFromNext } from '@/lib/portalShare';
import PortalThemeToggle from '@/components/portal/PortalThemeToggle';

// A shared portal link lands here first (the portal needs a login), so the preview card names the page it points at.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ next?: string }> }): Promise<Metadata> {
  const target = portalTargetFromNext((await searchParams).next);
  if (!target) {
    const title = 'Sign in · Triton Gaming Portal';
    const description = 'Members and officers: sign in to the Triton Gaming portal.';
    return { title: 'Sign In', openGraph: { title, description, images: ['/opengraph-image'] }, twitter: { card: 'summary_large_image', title, description, images: ['/opengraph-image'] } };
  }
  const title = `${target.name} · Triton Gaming Portal`;
  const description = 'Sign in to open this page.';
  const image = `/api/og/portal/${target.section}`;
  return { title, description, openGraph: { title, description, images: [image] }, twitter: { card: 'summary_large_image', title, description, images: [image] } };
}

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
      <div className={styles.themeSlot}><PortalThemeToggle /></div>

      <main className={styles.card}>
        <div className={styles.logoSection}>
          <Image
            src="/logos/tg_logo.png"
            alt="Triton Gaming"
            width={80}
            height={80}
            className={styles.logo}
            loading="eager"
            fetchPriority="high"
          />
          <h1 className={styles.title}>Triton Gaming</h1>
          <p className={styles.subtitle}>Member Portal</p>
        </div>


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
      </main>
    </div>
  );
}
