'use client';

import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { formatPacificDate } from '@/lib/core/timezone';
import styles from './points.module.css';
import type { PointsCtx } from './pointsCtx';
import { TYPE_LABELS, oneOf } from './pointsTypes';

export function CorrectionsPanel({
  adjustQuery,
  adjustResults,
  adjustTarget,
  canManagePoints,
  handleReverse,
  historyError,
  manageSubTab,
  reversingId,
  setAdjustQuery,
  setAdjustResults,
  setAdjustTarget,
  targetHistory,
}: PointsCtx) {
  return (
    <>
      {manageSubTab === 'corrections' && canManagePoints && (
        <div className={styles.adjustSection}>
          <h2 className={styles.sectionLabel}>Correct a Member&apos;s Points</h2>
          <p className={styles.hint}>Find a member to see their points history and reverse a specific entry.</p>

          <div className={styles.adjustSearchWrap}>
            <input
              className={styles.input}
              placeholder="Search member by name…"
              value={adjustTarget ? adjustTarget.title : adjustQuery}
              onChange={(e) => {
                setAdjustTarget(null);
                setAdjustQuery(e.target.value);
              }}
            />
            {adjustResults.length > 0 && !adjustTarget && (
              <div className={styles.adjustDropdown}>
                {adjustResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={styles.adjustResult}
                    onClick={() => {
                      setAdjustTarget(m);
                      setAdjustResults([]);
                    }}
                  >
                    {m.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {adjustTarget && (
            <>
              {historyError && <Notice tone="error">{historyError}</Notice>}
              {targetHistory === null ? (
                <Loading variant="inline" label="Loading history…" />
              ) : targetHistory.length === 0 ? (
                <p className={styles.empty}>No point activity for {adjustTarget.title} yet.</p>
              ) : (
                <div className={styles.targetHistory}>
                  {targetHistory.map((t) => {
                    const label = oneOf(t.event)?.title ?? TYPE_LABELS[t.type] ?? t.type;
                    return (
                      <div key={t.id} className={`${styles.targetHistoryRow} ${t.reversed_at ? styles.targetHistoryReversed : ''}`}>
                        <div className={styles.targetHistoryInfo}>
                          <div className={styles.historyType}>{label}</div>
                          <div className={styles.historyMeta}>
                            {t.note && t.type !== 'event_checkin' ? t.note : (TYPE_LABELS[t.type] ?? t.type)}
                            {' · '}
                            {formatPacificDate(t.created_at)}
                          </div>
                        </div>
                        <span className={`${styles.targetHistoryAmount} ${t.amount >= 0 ? styles.amountPositive : styles.amountNegative}`}>
                          {t.amount >= 0 ? '+' : ''}
                          {t.amount}
                        </span>
                        {t.reversed_at ? (
                          <span className={styles.reversedLabel}>Reversed</span>
                        ) : t.reverses_transaction_id ? (
                          // A reversal itself — can't be reversed again (server enforces this
                          // too); a mistaken reversal gets corrected with a new adjustment.
                          <span className={styles.reversedLabel}>Reversal</span>
                        ) : (
                          <button type="button" className={styles.reverseBtn} onClick={() => handleReverse(t)} disabled={reversingId === t.id}>
                            {reversingId === t.id ? 'Reversing…' : 'Reverse'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
