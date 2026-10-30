'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Placing } from '@/lib/trivia/types';
import { CountUp } from './shapes';
import styles from './trivia.module.css';

const fmt = (n: number) => n.toLocaleString('en-US');

// The scoreboard after a question, the way a quiz show does it: the rows first stand where they stood before the question with their old scores, then (a moment later) they slide to their new places
// while the scores count up, the bars grow, each person's points from this question pop out beside their name and a ▲ or ▼ says how many places they moved. With reduced motion it just shows the result.
export default function Scoreboard({ rows }: { rows: Placing[] }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => setGo(true), calm ? 0 : 1000);
    return () => window.clearTimeout(id);
  }, []);
  const maxScore = Math.max(1, ...rows.map((r) => r.score));
  // Where each row stands before and after: the old order is the order of their old places (those who were lower start lower).
  const start = [...rows].sort((a, b) => (a.prevRank ?? a.rank) - (b.prevRank ?? b.rank) || a.rank - b.rank);
  const slot = (r: Placing, i: number) => (go ? i : start.indexOf(r));
  return (
    <div className={styles.sb} style={{ '--n': rows.length } as CSSProperties} aria-label="Scoreboard">
      {rows.map((r, i) => {
        const moved = r.prevRank !== undefined ? r.prevRank - r.rank : 0;
        const from = r.prevScore ?? r.score;
        return (
          <div key={r.id ?? `${r.name}-${i}`} className={styles.sbRow} style={{ '--i': slot(r, i), '--d': `${i * 70}ms` } as CSSProperties}>
            <span className={styles.sbBar} style={{ transform: `scaleX(${(go ? r.score : from) / maxScore})` }} />
            <span className={`${styles.rankNum} ${(go ? r.rank : (r.prevRank ?? r.rank)) === 1 ? styles.rankNum1 : ''} ${go ? styles.sbRankFlip : ''}`} key={go ? 'new' : 'old'}>
              {go ? r.rank : (r.prevRank ?? r.rank)}
            </span>
            <span className={styles.sbName}>{r.name}</span>
            {go && (r.pts ?? 0) > 0 && (
              <span className={styles.sbPts} style={{ animationDelay: `${i * 70}ms` }}>
                +{fmt(r.pts!)}
              </span>
            )}
            {go && moved !== 0 && (
              <span className={`${styles.sbMove} ${moved > 0 ? styles.sbUp : styles.sbDown}`} style={{ animationDelay: `${700 + i * 70}ms` }}>
                {moved > 0 ? <ArrowUp size={14} aria-label="Up" /> : <ArrowDown size={14} aria-label="Down" />}
                {Math.abs(moved)}
              </span>
            )}
            <b className={styles.sbScore}>{go ? <CountUp value={r.score} from={from} ms={1100} format={fmt} /> : fmt(from)}</b>
          </div>
        );
      })}
    </div>
  );
}
