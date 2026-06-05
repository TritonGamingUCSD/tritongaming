import Image from 'next/image';
import styles from './ExecCard.module.css';
import type { OfficerEntry } from '@/types';

interface ExecCardProps {
  exec: OfficerEntry;
  reverse?: boolean;
}

function formatName(first: string, last: string, tag: string) {
  if (!tag) return `${first} ${last}`;
  return `${first} "${tag}" ${last}`;
}

export default function ExecCard({ exec, reverse = false }: ExecCardProps) {
  const { first_name, gamer_tag, last_name, bio, year, major, profile_picture } = exec.officer;
  const picSrc = profile_picture
    ? profile_picture.startsWith('/')
      ? profile_picture
      : `/${profile_picture}`
    : null;

  return (
    <div className={`${styles.card} ${reverse ? styles.reverse : ''}`}>
      <div className={`${styles.imgWrapper} ${reverse ? styles.imgReverse : ''}`}>
        {picSrc ? (
          <Image
            src={picSrc}
            alt={`${first_name} ${last_name}`}
            fill
            sizes="(max-width: 640px) 80vw, 320px"
            style={{ objectFit: 'cover', objectPosition: 'top' }}
          />
        ) : (
          <div className={styles.imgPlaceholder} />
        )}
      </div>

      <div className={`${styles.info} ${reverse ? styles.infoReverse : ''}`}>
        <h3 className={styles.name}>{formatName(first_name, last_name, gamer_tag)}</h3>
        <div className={styles.subinfo}>
          <p>{exec.title}</p>
          <p>{year}</p>
          <p>{major}</p>
        </div>
        {bio && <p className={styles.bio}>{bio}</p>}
      </div>

      <div className={`${styles.bgWrapper} ${reverse ? styles.bgReverse : ''}`} aria-hidden="true">
        <span className={styles.bgTag}>{gamer_tag}</span>
      </div>
    </div>
  );
}
