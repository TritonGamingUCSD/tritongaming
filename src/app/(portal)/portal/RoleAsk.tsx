import Link from '@/components/portal/PortalLink';
import { ROLE_ASKS } from '@/lib/notifications/helpConstants';
import styles from './roleAsk.module.css';

// For people with no team role yet: the way to ask for one. Each link opens Help with the account category, a subject and a starter message already filled in.
export default function RoleAsk() {
  return (
    <section className={styles.roleAsk} aria-label="Ask for a role">
      <div className={styles.roleText}>
        <span className={styles.kicker}>Want to help run things?</span>
        <h2 className={styles.roleTitle}>Need a role or access to a tool?</h2>
        <p className={styles.meta}>Officers, division leads and exec get extra tools here. Send a request through Help and we will fill in the details for you.</p>
      </div>
      <div className={styles.roleActions}>
        <Link href="/portal/help/ask?topic=role" className={styles.cta}>Request a role</Link>
        <p className={styles.roleQuick}>Or start with: {ROLE_ASKS.map((r, i) => <span key={r.id}>{i > 0 && ' · '}<Link href={`/portal/help/ask?topic=role&role=${r.id}`}>{r.label}</Link></span>)}</p>
      </div>
    </section>
  );
}
