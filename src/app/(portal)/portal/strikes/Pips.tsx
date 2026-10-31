'use client';

import { countLabel } from '@/lib/members/strikeLabels';
import styles from './tracker.module.css';

// The first mark is a warning, not a strike: a diamond set apart from the three round strikes, with the plain count written beside it.
export function Pips({ active, limit }: { active: number; limit: number }) {
  const bad = active >= limit;
  return (
    <span
      className={`${styles.pipsWrap} ${bad ? styles.pipsBad : active ? styles.pipsWarn : ''}`}
      role="img"
      aria-label={countLabel(active)}
      title="A warning first, then 3 strikes"
    >
      <span className={styles.pips}>
        <i className={`${styles.warnPip} ${active >= 1 ? styles.on : ''}`} />
        {Array.from({ length: limit - 1 }, (_, i) => (
          <i key={i} className={i + 1 < active ? styles.on : ''} />
        ))}
      </span>
      <small className={styles.pipLabel}>{countLabel(active)}</small>
    </span>
  );
}
