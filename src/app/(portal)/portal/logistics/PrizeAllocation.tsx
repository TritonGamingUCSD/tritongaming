'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { suggestPrizes } from '@/lib/logistics/prizes';
import { Combo } from './Combo';
import { NumberCell } from './Cells';
import { PoolDialog } from './PlanPrizes';
import PrizeGrid from './PrizeGrid';
import { usePrizes, type PrizeRow } from './usePrizes';
import type { PlanApi } from './usePlans';
import type { Catalog } from './useLogistics';
import styles from './logistics.module.css';

const money = (n: number | null) => (n === null ? '' : `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`);

// Prizing allocation, one card per pool (a prize request makes a pool for its team): what was asked for (how many, how many dollars) with progress, the prizes it has, and a box to add more from
// storage and the sponsor prizes of this event. Suggest fills what is still missing with the prizes closest to the asked value. The old grid is kept below as an overview.
export default function PrizeAllocation({ plan, data }: { plan: PlanApi; data: Catalog }) {
  const d = plan.detail!;
  const prizes = usePrizes();
  const closed = d.plan.status === 'closed';
  const manage = d.canManage && !closed;
  const { pools, lines } = d.prizes;
  const [poolDialog, setPoolDialog] = useState<(typeof pools)[number] | null>(null);
  const [busy, setBusy] = useState('');
  const [short, setShort] = useState<Record<string, number>>({});   // how many a Suggest could not find in stock
  const sponsorName = useMemo(() => new Map(data.sponsors.map((s) => [s.id, s.name])), [data.sponsors]);
  const available = useMemo(() => (prizes.rows ?? []).filter((p) => !p.plan_id || p.plan_id === d.plan.id), [prizes.rows, d.plan.id]);
  const summary = (p: PrizeRow) => ({ id: p.id, name: p.name, sponsor: sponsorName.get(p.sponsor_id ?? '') ?? null, size: p.size, price: p.price, quantity: p.quantity, quantity_is_estimate: p.quantity_is_estimate, left: p.left });

  async function setQty(poolId: string, p: PrizeRow, n: number) {
    const r = await plan.setPrizeLine(poolId, summary(p), Math.max(0, Math.round(n)));
    if (r.ok && r.delta) prizes.bump(p.id, r.delta);
  }
  async function suggest(pool: (typeof pools)[number], need: number, budget: number) {
    setBusy(pool.id);
    const picks = suggestPrizes(available.map((p) => ({ id: p.id, price: p.price, left: p.left, sponsor: !!p.sponsor_id })), need, budget);
    for (const [id, n] of picks) {
      const p = available.find((x) => x.id === id);
      if (!p) continue;
      const have = lines.find((l) => l.pool_id === pool.id && l.prize_id === id)?.quantity ?? 0;
      await setQty(pool.id, p, have + n);
    }
    setShort((c) => ({ ...c, [pool.id]: Math.max(0, need - [...picks.values()].reduce((n, x) => n + x, 0)) }));
    setBusy('');
  }

  if (!prizes.rows) return <div className={styles.tab}><p className={styles.muted}>Loading…</p></div>;
  return (
    <div className={styles.tab}>
      {poolDialog && <PoolDialog plan={plan} pool={poolDialog} onClose={() => setPoolDialog(null)} />}
      {pools.length === 0 ? (
        <div className={styles.empty}><p>No prize requests yet. A request for prizes makes a card here for its team.</p></div>
      ) : (
        <div className={styles.poolCards}>
          {pools.map((pool) => {
            const mine = lines.filter((l) => l.pool_id === pool.id);
            const count = mine.reduce((n, l) => n + l.quantity, 0);
            const spent = Math.round(mine.reduce((n, l) => n + l.quantity * (l.prize.price ?? 0), 0) * 100) / 100;
            const needQty = pool.target_qty === null ? null : Math.max(0, pool.target_qty - count);
            const budget = pool.target_total === null ? 0 : pool.target_total - spent;
            const addable = available.filter((p) => p.left > 0 && !mine.some((l) => l.prize_id === p.id));
            const label = (p: PrizeRow) => `${p.name} · ${sponsorName.get(p.sponsor_id ?? '') ?? 'Club'}${p.price !== null ? ` · ${money(p.price)}` : ''} · ${p.left} left`;
            const countState = pool.target_qty === null ? '' : count === pool.target_qty ? styles.barOk : count > pool.target_qty ? styles.barBad : styles.barWarn;
            return (
              <section key={pool.id} className={styles.poolCard} aria-label={pool.name}>
                <header className={styles.poolCardHead}>
                  <div className={styles.poolTitle}>
                    <b>{pool.name}</b>
                    {pool.station_id && <span className={styles.dim}>{d.stations.find((s) => s.id === pool.station_id)?.name}</span>}
                  </div>
                  {manage && <button type="button" className={styles.linkBtn} onClick={() => setPoolDialog(pool)}>Edit</button>}
                </header>
                {pool.target_qty !== null && pool.target_total !== null ? (
                  <div className={styles.poolGoal}>
                    <div className={styles.goalLine}><span>Prizes</span><b className={countState === styles.barBad ? styles.flagBad : undefined}>{count} / {pool.target_qty}</b></div>
                    <div className={`${styles.bar} ${countState}`}><i style={{ width: `${Math.min(100, pool.target_qty ? (count / pool.target_qty) * 100 : 0)}%` }} /></div>
                    <div className={styles.goalLine}><span>Value</span><b className={spent > pool.target_total ? styles.flagBad : undefined}>{money(spent) || '$0'} / {money(pool.target_total)}</b></div>
                  </div>
                ) : <p className={styles.muted}>{count} prizes · {money(spent) || '$0'}</p>}
                {mine.length > 0 && (
                  <ul className={styles.poolLines}>
                    {mine.map((l) => {
                      const p = available.find((x) => x.id === l.prize_id);
                      return (
                        <li key={l.id} className={styles.poolLine}>
                          <span className={styles.poolLineName}><b>{l.prize.name}</b><small className={styles.dim}>{l.prize.sponsor ?? 'Club'}{l.prize.price !== null ? ` · ${money(l.prize.price)}` : ''}</small></span>
                          <NumberCell value={l.quantity} canEdit={manage && !!p} nullable label={`${l.prize.name} for ${pool.name}`} onSave={(n) => p && void setQty(pool.id, p, n ?? 0)} />
                          <span className={`${styles.leftChip} ${l.prize.left < 0 ? styles.leftBad : l.prize.left === 0 ? styles.leftZero : styles.leftOk}`}>{l.prize.left} left</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(short[pool.id] ?? 0) > 0 && <p className={styles.flagWarn}>{short[pool.id]} more could not be found in stock.</p>}
                {manage && (
                  <div className={styles.poolFoot}>
                    <div className={styles.poolAdd}>
                      <Combo value={null} options={addable.map(label)} placeholder="Add a prize…" clearable={false} ariaLabel={`Add a prize to ${pool.name}`} onChange={(v) => { const p = addable.find((x) => label(x) === v); if (p) void setQty(pool.id, p, 1); }} />
                    </div>
                    {needQty !== null && needQty > 0 && <Button size="sm" variant="secondary" loading={busy === pool.id} onClick={() => void suggest(pool, needQty, budget)}>Suggest {needQty}</Button>}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <details className={styles.overview2}>
        <summary>Grid overview</summary>
        <PrizeGrid plan={plan} data={data} />
      </details>
    </div>
  );
}
