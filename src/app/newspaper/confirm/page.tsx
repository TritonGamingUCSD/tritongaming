import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyConfirmToken } from '@/lib/email/unsubscribe';
import ConfirmButton from './ConfirmButton';
import styles from '../../email/unsubscribe/unsubscribe.module.css';

export const metadata: Metadata = { title: 'Confirm Your Email', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Where the link in the confirm email lands: one button adds the address (a page, not the link itself, so a mail scanner opening it can't subscribe anyone).
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = '' } = await searchParams;
  const ok = !!verifyConfirmToken(t);
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.sticker}>Triton Gaming</span>
        {ok ? (
          <>
            <h1 className={styles.title}>Get the newspaper?</h1>
            <p className={styles.text}>Press the button to confirm this address. You can stop any time with the button in every email.</p>
            <ConfirmButton token={t} />
          </>
        ) : (
          <>
            <h1 className={styles.title}>That link doesn’t work</h1>
            <p className={styles.text}>It may be cut off or out of date. You can sign up again any time.</p>
            <Link className={styles.link} href="/newspaper">
              Go to the sign-up page
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
