'use client';

import Notice from '@/components/ui/Notice';
import { Check, Gift, Lock, } from 'lucide-react';
import { formatPacificDate } from '@/lib/core/timezone';
import Button from '@/components/ui/Button';
import styles from './points.module.css';
import type { PointsCtx } from './pointsCtx';
import { TYPE_LABELS, oneOf } from './pointsTypes';

export function MyPointsTab({ balance, claimedNote, claimingId, handleClaimUnlock, lifetimeEarned, next, readyToClaimUnlocks, setShowTierLadder, shopError, shopItems, showTierLadder, tab, tier, tiers, transactions, unlocks }: PointsCtx) {
  return (
    <>
      {tab === 'mine' && (
        <div className={styles.pointsTab}>
          <section className={styles.hero} style={{ ['--tier' as string]: tier.color }} aria-label="Your points">
            <div className={styles.heroTop}>
              <span className={styles.heroKicker}>Your points</span>
              <span className={styles.tierTag}>{tier.name}</span>
            </div>
            <div className={styles.heroNum}>
              {balance.toLocaleString()}
              <small>to spend</small>
            </div>
            <ol className={styles.ladder} aria-label="Tiers" tabIndex={0}>
              {tiers.map((t) => (
                <li
                  key={t.name}
                  className={`${styles.rung} ${lifetimeEarned >= t.min ? styles.rungReached : ''} ${t.name === tier.name ? styles.rungNow : ''}`}
                  style={{ ['--rc' as string]: t.color }}
                >
                  <i aria-hidden="true" />
                  <b>{t.name}</b>
                  <span>{t.min.toLocaleString()}</span>
                </li>
              ))}
            </ol>
            <p className={styles.heroNote}>
              {lifetimeEarned.toLocaleString()} earned in total
              {next ? (
                <>
                  {' '}
                  · <strong>{(next.min - lifetimeEarned).toLocaleString()} pts</strong> to {next.name}
                </>
              ) : (
                ' · top tier reached'
              )}
            </p>
          </section>

          {shopError && <Notice tone="error">{shopError}</Notice>}

          {shopItems !== null && unlocks.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.tierUnlocksHeader}>
                <h2 className={styles.sectionLabel}>
                  <Gift size={14} strokeWidth={1.75} aria-hidden="true" /> Tier Unlocks
                </h2>
                <Button type="button" onClick={() => setShowTierLadder((v) => !v)} variant="secondary" size="sm">
                  {showTierLadder ? 'Hide Full Ladder' : 'View Full Ladder'}
                </Button>
              </div>
              {claimedNote && (
                <p className={styles.claimedNote}>
                  <Check size={14} strokeWidth={2} aria-hidden="true" /> {claimedNote}
                </p>
              )}

              {/* What's actually actionable stays visible regardless of the
                  toggle below — the full ladder (every tier, including ones
                  you're nowhere near or already claimed) is the part that
                  was eating vertical space for content that's rarely the
                  reason you're on this tab. */}
              {readyToClaimUnlocks.length > 0 ? (
                <ul className={styles.readyToClaimList}>
                  {readyToClaimUnlocks.map((u) => (
                    <li key={u.id} className={styles.readyToClaimRow}>
                      <span className={styles.readyToClaimTitle}>{u.title}</span>
                      <Button type="button" onClick={() => handleClaimUnlock(u)} disabled={claimingId === u.id} size="sm">
                        {claimingId === u.id ? 'Claiming…' : 'Claim'}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                !showTierLadder && <p className={styles.hint}>Free perks you unlock automatically by reaching a tier — nothing ready to claim right now.</p>
              )}

              {/* Grouped by tier (in tier order) rather than one flat grid — which
                  tier unlocks which reward was otherwise only visible as small print
                  on a locked card's button, easy to miss entirely on an unlocked/claimed one. */}
              {showTierLadder &&
                tiers.map((t) => {
                  const rewardsForTier = unlocks.filter((u) => (u.min_tier ?? tiers[0].name) === t.name);
                  if (rewardsForTier.length === 0) return null;
                  return (
                    <div key={t.name} className={styles.tierGroup}>
                      <div className={styles.tierGroupHeader}>
                        <span className={styles.tierGroupBadge} style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}55` }}>
                          {t.name}
                        </span>
                        <span className={styles.tierGroupThreshold}>{t.min.toLocaleString()} lifetime pts</span>
                      </div>
                      <div className={styles.shopGrid}>
                        {rewardsForTier.map((u) => (
                          <div
                            key={u.id}
                            className={`${styles.shopCard} ${u.unlocked ? styles.unlockCardReady : styles.unlockCardLocked}`}
                            style={u.unlocked ? { borderColor: `${t.color}55` } : undefined}
                          >
                            <h3 className={styles.shopCardTitle}>{u.title}</h3>
                            {u.description && <p className={styles.shopCardDesc}>{u.description}</p>}
                            <div className={styles.shopCardFooter}>
                              {u.claimed ? (
                                <span className={styles.unlockClaimedLabel}>
                                  <Check size={13} strokeWidth={2} aria-hidden="true" /> Claimed
                                </span>
                              ) : u.unlocked ? (
                                <Button type="button" onClick={() => handleClaimUnlock(u)} disabled={claimingId === u.id} size="sm">
                                  {claimingId === u.id ? 'Claiming…' : 'Claim'}
                                </Button>
                              ) : (
                                <span className={styles.unlockLockedLabel}>
                                  <Lock size={12} strokeWidth={1.75} aria-hidden="true" /> Reach {t.name} to unlock
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <div className={styles.historySection}>
            <h2 className={styles.sectionLabel}>Recent Activity</h2>
            {transactions.length === 0 ? (
              <p className={styles.empty}>No activity yet — check into an event to start earning.</p>
            ) : (
              <ul className={styles.historyList}>
                {transactions.map((t) => {
                  const event = oneOf(t.event);
                  return (
                    <li key={t.id} className={styles.historyRow}>
                      <div>
                        <div className={styles.historyType}>
                          {event?.title ?? TYPE_LABELS[t.type] ?? t.type}
                          {t.reversed_at && <span className={styles.reversedTag}> · reversed</span>}
                        </div>
                        <div className={styles.historyMeta}>
                          {t.note && t.type !== 'event_checkin' ? t.note : (TYPE_LABELS[t.type] ?? t.type)}
                          {' · '}
                          {formatPacificDate(t.created_at)}
                        </div>
                      </div>
                      <span className={t.amount >= 0 ? styles.amountPositive : styles.amountNegative}>
                        {t.amount >= 0 ? '+' : ''}
                        {t.amount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
