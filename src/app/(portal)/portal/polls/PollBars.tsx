'use client';

import { Star } from 'lucide-react';
import type { PollMode, Standing } from './api';
import styles from './polls.module.css';

/** What a bar's number means for the way of voting. */
export const unitOf = (mode: PollMode, n: number): string =>
  mode === 'one' ? `${n} ${n === 1 ? 'vote' : 'votes'}` : mode === 'top3' ? `${n} ${n === 1 ? 'point' : 'points'}` : `${n.toFixed(2).replace(/\.?0+$/, '')} ★`;

// The standings as bars, best first. `shown` is how many of them (counting from the last place) are on screen, so the host can bring the places in one at a time and the winner last; the winner is marked.
export function PollBars({ standings, mode, shown = standings.length, big = false }: { standings: Standing[]; mode: PollMode; shown?: number; big?: boolean }) {
  const max = Math.max(1, ...standings.map((s) => s.total));
  const hidden = standings.length - shown; // the best places, still hidden
  return (
    <ol className={`${styles.bars} ${big ? styles.barsBig : ''}`}>
      {standings.map((s, i) => {
        const on = i >= hidden;
        const win = s.place === 1 && on && s.total > 0;
        return (
          <li key={s.id} className={`${styles.bar} ${on ? styles.barOn : styles.barOff} ${win ? styles.barWin : ''}`}>
            <span className={styles.barPlace}>{s.place}</span>
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.barImg} src={s.image} alt="" loading="lazy" />
            ) : (
              <span className={styles.barNum}>{s.number}</span>
            )}
            <span className={styles.barBody}>
              <span className={styles.barName}>
                <b>
                  #{s.number} {s.name}
                </b>
                {s.subtitle && <i>{s.subtitle}</i>}
              </span>
              <span className={styles.barTrack}>
                <span className={styles.barFill} style={{ width: on ? `${Math.max(2, (s.total / max) * 100)}%` : '0%' }} />
              </span>
            </span>
            <span className={styles.barTotal}>
              {win && <Star size={big ? 28 : 18} aria-hidden="true" />} {unitOf(mode, s.total)}
              {mode === 'score' && s.voters > 0 && <small> · {s.voters} rated</small>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
