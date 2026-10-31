'use client';

import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import styles from './points.module.css';
import type { PointsCtx } from './pointsCtx';

export function LeaderboardTab({ anonymous, board, boardError, savingPrefs, setAnonymousPref, tab, tiers }: PointsCtx) {
  return (
    <>
      {tab === 'leaderboard' && (
        <div className={styles.leaderboardTab}>
          <div className={styles.prefsCard}>
            <label className={styles.checkboxField}>
              <input type="checkbox" checked={anonymous} disabled={savingPrefs} onChange={(e) => setAnonymousPref(e.target.checked)} />
              <span>Stay anonymous on the leaderboard (otherwise shown under your name)</span>
            </label>
            <p className={styles.hint}>
              Everyone&apos;s on the leaderboard — this only controls whether your full name or a masked version (like "Jas***") shows next to your rank. Your exact points are
              always shown either way.
            </p>
          </div>

          {boardError && <Notice tone="error">{boardError}</Notice>}
          {board === null ? (
            <Loading label="Loading leaderboard…" />
          ) : board.length === 0 ? (
            <p className={styles.empty}>No one&apos;s ranked yet.</p>
          ) : (
            <ol className={styles.boardList}>
              {board.map((row) => {
                const rowTier = tiers.find((t) => t.name === row.tier) ?? tiers[0];
                return (
                  <li key={row.rank} className={`${styles.boardRow} ${row.isSelf ? styles.boardRowSelf : ''}`}>
                    <span className={styles.boardRank}>#{row.rank}</span>
                    <span className={styles.boardName}>
                      {row.name}
                      {row.isSelf ? ' (you)' : ''}
                    </span>
                    <span className={styles.boardTier} style={{ color: `color-mix(in srgb, ${rowTier.color} 55%, var(--pp-ink))`, borderColor: `${rowTier.color}88` }}>
                      {row.tier}
                    </span>
                    <span className={styles.boardPoints}>{row.points.toLocaleString()} pts</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </>
  );
}
