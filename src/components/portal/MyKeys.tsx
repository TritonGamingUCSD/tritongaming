import Link from '@/components/portal/NoPrefetchLink';
import { KeyRound } from 'lucide-react';
import styles from './MyKeys.module.css';

// "You have these storage keys", on the dashboard. The keys come from the portal page (it already knows who holds what); shows nothing
// unless you hold at least one.
export default function MyKeys({ keys }: { keys: { id: string; name: string; color: string }[] }) {
  if (keys.length === 0) return null;
  return (
    <section className={styles.wrap} aria-label="Your storage keys">
      <span className={styles.label}>{keys.length === 1 ? 'You have a storage key' : `You have ${keys.length} storage keys`}</span>
      <span className={styles.pills}>
        {keys.map((k) => <span key={k.id} className={styles.pill} style={{ background: k.color }}><KeyRound size={14} strokeWidth={2.5} aria-hidden="true" /> {k.name}</span>)}
      </span>
      <Link href="/portal/keys" className={styles.link}>Open Storage Keys →</Link>
    </section>
  );
}
