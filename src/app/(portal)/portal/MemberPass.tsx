import Image from 'next/image';
import Link from '@/components/portal/PortalLink';
import { Ticket } from 'lucide-react';
import styles from './memberPass.module.css';

export interface PassData {
  name: string;
  /** "UCSD Student", "Guest"… */
  role: string;
  avatarUrl: string | null;
  /** Students: their points and level. Guests have none. */
  points: { balance: string; tier: string } | null;
  guest: boolean;
  /** The next event's ticket link for the welcome ticket's third step. */
  nextHref: string;
}

// The home page of someone who is not on the Triton Gaming team: a paper pass with a perforated stub. A student's pass shows their name, role sticker, points and level, and the stub opens their code; a guest gets a
// welcome ticket with three steps to unlock the rest.
export default function MemberPass({ pass }: { pass: PassData }) {
  if (pass.guest) {
    return (
      <article className={styles.pass} aria-label="Welcome">
        <div className={styles.main}>
          <span className={styles.sticker}>Welcome</span>
          <h2 className={styles.name}>Hi {pass.name.split(' ')[0] || 'there'}, you are in.</h2>
          <p className={styles.sub}>Three quick steps open up the rest of the portal.</p>
          <ol className={styles.steps}>
            <li>
              <b>1</b>
              <span>
                Add your UCSD email in your <Link href="/portal/profile">profile</Link> to become a UCSD Student.
              </span>
            </li>
            <li>
              <b>2</b>
              <span>Finish the rest of your profile so we know who is checking in.</span>
            </li>
            <li>
              <b>3</b>
              <span>
                <Link href={pass.nextHref}>Pick up a ticket</Link> for the next event and show up.
              </span>
            </li>
          </ol>
        </div>
        <div className={styles.stub} aria-hidden="true">
          <Ticket size={26} />
          <span>Admit one</span>
        </div>
      </article>
    );
  }
  return (
    <article className={styles.pass} aria-label="Your member pass">
      <div className={styles.main}>
        <span className={styles.sticker}>Member Pass</span>
        <div className={styles.who}>
          {pass.avatarUrl ? (
            <Image src={pass.avatarUrl} alt="" width={52} height={52} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
          ) : (
            <span className={styles.avatarFallback}>{pass.name.slice(0, 1)}</span>
          )}
          <div>
            <h2 className={styles.name}>{pass.name}</h2>
            <span className={styles.role}>{pass.role}</span>
          </div>
        </div>
        {pass.points && (
          <p className={styles.points}>
            <b>{pass.points.balance}</b> pts <span>· {pass.points.tier}</span>
          </p>
        )}
      </div>
      <Link href="/portal/profile/qr" className={styles.stub}>
        <Ticket size={26} aria-hidden="true" />
        <span>Show my code</span>
      </Link>
    </article>
  );
}
