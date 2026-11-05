import Link from '@/components/portal/PortalLink';
import CountUp from '@/components/ui/CountUp';
import styles from './homeCards.module.css';

export interface HomeCard {
  id: string;
  title: string;
  /** Small status on the right of the title ("2 upcoming", "All clear", "For Officers"). */
  status?: string;
  body: string;
  href: string;
  action: string;
  /** Something this person cannot use yet: shown dashed, so they know it exists and who it is for. */
  locked?: boolean;
  /** A big number in the pixel face (points) and, with `progress` (0 to 100), a bar to the next level. */
  figure?: string;
  progress?: number;
}

// Home's cards, all one pattern: the title on the left and a small status on the right, a hairline, one line of what is going on, and one link at the bottom.
export default function HomeCards({ cards }: { cards: HomeCard[] }) {
  if (cards.length === 0) return null;
  const band = cards.filter((c) => !c.locked);
  const locked = cards.filter((c) => c.locked);
  const one = (c: HomeCard) => (
    <li key={c.id} className={`${styles.card} ${c.locked ? styles.locked : ''}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>{c.title}</h2>
        {c.status && <span className={`${styles.status} ${c.status === 'On now' ? styles.live : ''}`}>{c.status}</span>}
      </div>
      {c.figure && (
        <p className={styles.figure}>
          <CountUp text={c.figure} />
        </p>
      )}
      {c.progress !== undefined && (
        <span className={styles.xp} role="img" aria-label={`${Math.round(c.progress)} percent of the way to the next level`}>
          <span style={{ width: `${c.progress}%` }} />
        </span>
      )}
      <p className={styles.body}>{c.body}</p>
      <Link href={c.href} className={styles.action}>
        {c.action} →
      </Link>
    </li>
  );
  return (
    <>
      {/* The cards a person can use sit in one band with thin dividers and share the full width; the ones for a role they do not have are dashed and stand apart. */}
      {band.length > 0 && (
        <ul className={styles.band} aria-label="Your portal">
          {band.map(one)}
        </ul>
      )}
      {locked.length > 0 && (
        <ul className={styles.grid} aria-label="For other roles">
          {locked.map(one)}
        </ul>
      )}
    </>
  );
}
