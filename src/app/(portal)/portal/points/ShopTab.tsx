'use client';

import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import CodeIcon from '@/components/portal/CodeIcon';
import Button from '@/components/ui/Button';
import styles from './points.module.css';
import type { PointsCtx } from './pointsCtx';
import { oneOf } from './pointsTypes';

export function ShopTab({ claimingId, handleClaim, pending, setQrFor, shopBalance, shopError, shopItems, tab, tier, tiers }: PointsCtx) {
  return (
    <>
      {tab === 'shop' && (
        <div className={styles.shopTab}>
          <div className={styles.shopBalance}>
            Spendable balance: <strong>{shopBalance.toLocaleString()} pts</strong>
          </div>
          {shopError && <Notice tone="error">{shopError}</Notice>}

          {pending.length > 0 && (
            <div className={styles.pendingSection}>
              <h2 className={styles.sectionLabel}>Ready to Claim</h2>
              <p className={styles.hint}>Show one of these to an officer at an event to receive it.</p>
              <div className={styles.pendingGrid}>
                {pending.map((r) => {
                  const reward = oneOf(r.reward);
                  return (
                    <button key={r.id} type="button" className={styles.pendingCard} onClick={() => setQrFor(r.id)}>
                      <CodeIcon size={20} use="reward" />
                      <span>{reward?.title ?? 'Reward'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {shopItems === null ? (
            <Loading label="Loading shop…" />
          ) : shopItems.length === 0 ? (
            <p className={styles.empty}>Nothing in the shop yet — check back soon.</p>
          ) : (
            <div className={styles.shopGrid}>
              {shopItems.map((item) => {
                const outOfStock = item.stock !== null && item.stock <= 0;
                const canAfford = shopBalance >= item.point_cost;
                const requiredTierIdx = item.min_tier ? tiers.findIndex((t) => t.name === item.min_tier) : -1;
                const currentTierIdx = tiers.findIndex((t) => t.name === tier.name);
                const tierLocked = requiredTierIdx !== -1 && currentTierIdx < requiredTierIdx;
                return (
                  <div key={item.id} className={styles.shopCard}>
                    <h3 className={styles.shopCardTitle}>{item.title}</h3>
                    {item.description && <p className={styles.shopCardDesc}>{item.description}</p>}
                    {item.min_tier && <p className={styles.stockNote}>Requires {item.min_tier} tier</p>}
                    {item.stock !== null && <p className={styles.stockNote}>{outOfStock ? 'Out of stock' : `${item.stock} left`}</p>}
                    <div className={styles.shopCardFooter}>
                      <span className={styles.shopCardCost}>{item.point_cost} pts</span>
                      <Button size="sm" onClick={() => handleClaim(item)} disabled={!canAfford || outOfStock || tierLocked || claimingId === item.id}>
                        {claimingId === item.id ? 'Claiming…' : outOfStock ? 'Sold Out' : tierLocked ? `${item.min_tier}+ Only` : !canAfford ? 'Not Enough' : 'Redeem'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
