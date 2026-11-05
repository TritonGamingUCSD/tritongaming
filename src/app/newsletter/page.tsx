import type { Metadata } from 'next';
import SubscribeForm from './SubscribeForm';
import styles from '../email/unsubscribe/unsubscribe.module.css';

export const metadata: Metadata = { title: 'Get The Newsletter', description: 'News from Triton Gaming, the Gaming Org at UC San Diego, in your inbox.' };

// The public place to get the club's email without an account: an email box (and an optional first name). A confirm email comes next; nobody is added until they press its button.
export default function NewsletterPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.sticker}>Triton Gaming</span>
        <h1 className={styles.title}>Get The Newsletter</h1>
        <p className={styles.text}>News, events and good times from Triton Gaming, the Gaming Org at UC San Diego, in your inbox now and then. Every email has a button to stop.</p>
        <SubscribeForm />
      </div>
    </main>
  );
}
