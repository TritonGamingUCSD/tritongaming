import type { Metadata } from 'next';
import { EMAIL_KINDS } from '@/lib/email/prefs';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import UnsubscribeButton from './UnsubscribeButton';
import styles from './unsubscribe.module.css';

export const metadata: Metadata = { title: 'Email Settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Where the opt-out link in an email lands: no sign-in, one button. The link names the person and the kind of email (signed, so it cannot be made up).
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = '' } = await searchParams;
  const who = verifyUnsubscribeToken(t);
  const kind = who ? EMAIL_KINDS.find((k) => k.id === who.kind) : null;
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.sticker}>Triton Gaming</span>
        {kind ? (
          <>
            <h1 className={styles.title}>Stop {kind.label.toLowerCase()} emails?</h1>
            <p className={styles.text}>{kind.hint} You will stop getting this kind of email. Other emails from the club are not affected.</p>
            <UnsubscribeButton token={t} />
          </>
        ) : (
          <>
            <h1 className={styles.title}>That link doesn’t work</h1>
            <p className={styles.text}>It may be cut off or out of date. You can choose which emails you get in your profile.</p>
            <a className={styles.link} href="/portal/profile">Open email settings</a>
          </>
        )}
      </div>
    </main>
  );
}
