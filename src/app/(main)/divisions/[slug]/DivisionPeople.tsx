import Image from 'next/image';
import { resolveAvatarUrl, isVisible } from '@/lib/members/profile';
import type { DivisionLead } from './getDivisionHubData';
import styles from './division.module.css';

// Name tags for a division's people (Heads, Members or Alumni), only those who chose to show on the board.
export default function DivisionPeople({ people, roleLabel }: { people: DivisionLead[]; roleLabel: string }) {
  return (
    <ul className={styles.rosterGrid}>
      {people.map((p, i) => {
        const avatarUrl = resolveAvatarUrl(p);
        return (
          <li key={p.id} className={`${styles.rosterCard} ${i % 2 ? styles.tiltR : styles.tiltL}`}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={56} height={56} className={styles.rosterAvatar} unoptimized referrerPolicy="no-referrer" style={{ objectFit: 'cover' }} />
            ) : (
              <span className={styles.rosterAvatar}>{(p.display_name || '?')[0].toUpperCase()}</span>
            )}
            <span>
              <span className={styles.rosterName}>{p.display_name || 'Anonymous'}</span>
              <span className={styles.rosterRole}>{roleLabel}</span>
              {isVisible(p.board_visibility, 'pronouns') && p.pronouns && <span className={styles.rosterTag}>{p.pronouns}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
