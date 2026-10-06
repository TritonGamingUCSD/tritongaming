import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { STRIKES_AT_LIMIT } from '@/lib/strikeLabels';
import styles from './strikes.module.css';

// On the dashboard only at the limit: nothing below it (a person can always look in Profile → Strikes). Private: it is shown only to the person.
export default function StrikeCard({ active, limit }: { active: number; limit: number }) {
  if (active < limit) return null;   // limit counts the warning, so this is 3 strikes
  return (
    <Link href="/portal/profile/strikes" className={`${styles.card} ${styles.toneBad}`} aria-label="You are at the strike limit. See details in your Profile.">
      <span className={styles.shield}><ShieldAlert size={20} aria-hidden="true" /></span>
      <span className={styles.cardTitle}>
        <strong>You’re at {STRIKES_AT_LIMIT} strikes</strong>
        <span>The HR team will be contacting you. See details in your Profile.</span>
      </span>
    </Link>
  );
}
