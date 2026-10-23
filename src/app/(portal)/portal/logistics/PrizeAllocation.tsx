'use client';

import { RowMenu } from './RowMenu';
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
  const [swapLine, setSwapLine] = useState<string | null>(null);   // the pool line being swapped for a similar prize
  const [short, setShort] = useState<Record<string, number>>({});   // how many a Suggest could not find in stock
  const sponsorName = useMemo(() => new Map(data.sponsors.map((s) => [s.id, s.name])), [data.sponsors]);
  const available = useMemo(() => (prizes.rows ?? []).filter((p) => !p.plan_id || p.plan_id === d.plan.id), [prizes.rows, d.plan.id]);
  const summary = (p: PrizeRow) => ({ id: p.id, name: p.name, sponsor: sponsorName.get(p.sponsor_id ?? '') ?? null, size: p.size, type: p.type, price: p.price, quantity: p.quantity, quantity_is_estimate: p.quantity_is_estimate, in_hand: p.in_hand, left: p.left });

  async function setQty(poolId: string, p: PrizeRow, n: number) {
    const r = await plan.setPrizeLine(poolId, summary(p), Math.max(0, Math.round(n)));
    if (r.ok && r.delta) prizes.bump(p.id, r.delta);
  }
  // `used` is what other pools already took in the same go (Fill All), so two pools never take the last of a prize.
  async function suggest(pool: (typeof pools)[number], need: number, budget: number, used: Map<string, number> = new Map()) {
    setBusy(pool.id);
    const picks = suggestPrizes(available.filter((p) => p.in_hand).map((p) => ({ id: p.id, price: p.price, left: p.left - (used.get(p.id) ?? 0), sponsor: !!p.sponsor_id })), need, budget);
    for (const [id, n] of picks) used.set(id, (used.get(id) ?? 0) + n);
    for (const [id, n] of picks) {
      const p = available.find((x) => x.id === id);
      if (!p) continue;
      const have = lines.find((l) => l.pool_id === pool.id && l.prize_id === id)?.quantity ?? 0;
      await setQty(pool.id, p, have + n);
    }
    setShort((c) => ({ ...c, [pool.id]: Math.max(0, need - [...picks.values()].reduce((n, x) => n + x, 0)) }));
    setBusy('');
  }

  // Fill every pool that still needs prizes, one after another.
  async function fillAll() {
    const used = new Map<string, number>();
    for (const pool of pools) {
      if (pool.target_qty === null) continue;
      const mine = lines.filter((l) => l.pool_id === pool.id);
      const need = Math.max(0, pool.target_qty - mine.reduce((n, l) => n + l.quantity, 0));
      const spent = mine.reduce((n, l) => n + l.quantity * (l.prize.price ?? 0), 0);
      if (need > 0) await suggest(pool, need, (pool.target_total ?? 0) - spent, used);
    }
  }
  const needy = pools.filter((pool) => pool.target_qty !== null && lines.filter((l) => l.pool_id === pool.id).reduce((n, l) => n + l.quantity, 0) < pool.target_qty!).length;

  if (!prizes.rows) return <div className={styles.tab}><p className={styles.muted}>Loading…</p></div>;
  return (
    <div className={styles.tab}>
      {poolDialog && <PoolDialog plan={plan} pool={poolDialog} onClose={() => setPoolDialog(null)} />}
      {pools.length === 0 ? (
        <div className={styles.empty}><p>No prize requests yet. A request for prizes makes a card here for its team.</p></div>
      ) : (
        <>
        {manage && needy > 1 && <div className={styles.toolbarRow}><Button size="sm" variant="secondary" loading={!!busy} onClick={() => void fillAll()}>Fill All {needy} Pools</Button><span className={styles.muted}>Suggests prizes for every pool that still needs some, sponsor prizes first.</span></div>}
        <div className={styles.poolCards}>
          {pools.map((pool) => {
            const mine = lines.filter((l) => l.pool_id === pool.id);
            const count = mine.reduce((n, l) => n + l.quantity, 0);
            const spent = Math.round(mine.reduce((n, l) => n + l.quantity * (l.prize.price ?? 0), 0) * 100) / 100;
            const needQty = pool.target_qty === null ? null : Math.max(0, pool.target_qty - count);
            const budget = pool.target_total === null ? 0 : pool.target_total - spent;
            const addable = available.filter((p) => p.left > 0 && !mine.some((l) => l.prize_id === p.id));
            const label = (p: PrizeRow) => `${sponsorName.get(p.sponsor_id ?? '') ?? 'Club'} · ${p.name}${p.type ? ` · ${p.type}` : ''}${p.size ? ` · ${p.size}` : ''}${p.price !== null ? ` · ${money(p.price)}` : ''} · ${p.left} left${p.in_hand ? '' : ' · not here yet'}`;
            const overLines = mine.filter((l) => l.prize.left < 0).length;
            const groups = (() => { const g = new Map<string, typeof mine>(); for (const l of mine) { const k = l.prize.type ?? ''; g.set(k, [...(g.get(k) ?? []), l]); } return [...g].sort((a, b) => (a[0] === '' ? 1 : 0) - (b[0] === '' ? 1 : 0) || a[0].localeCompare(b[0])); })();
            const grouped = groups.some(([k]) => k !== '');
            const countState = pool.target_qty === null ? '' : count === pool.target_qty ? styles.barOk : count > pool.target_qty ? styles.barBad : styles.barWarn;
            return (
              <section key={pool.id} className={styles.poolCard} aria-label={pool.name}>
                <header className={styles.poolCardHead}>
                  <div className={styles.poolTitle}>
                    <b>{pool.name}</b>
                    {pool.station_id && <span className={styles.dim}>{d.stations.find((s) => s.id === pool.station_id)?.name}</span>}
                  </div>
                  {manage && <RowMenu label={`More for ${pool.name}`} items={[{ label: 'Edit', onClick: () => setPoolDialog(pool) }]} />}
                </header>
                {pool.target_qty !== null && pool.target_total !== null ? (
                  <div className={styles.poolGoal}>
                    <div className={styles.goalLine}><span>Prizes</span><b className={countState === styles.barBad ? styles.flagBad : undefined}>{count} / {pool.target_qty}</b></div>
                    <div className={`${styles.bar} ${countState}`}><i style={{ width: `${Math.min(100, pool.target_qty ? (count / pool.target_qty) * 100 : 0)}%` }} /></div>
                    <div className={styles.goalLine}><span>Value</span><b className={spent > pool.target_total ? styles.flagBad : undefined}>{money(spent) || '$0'} / {money(pool.target_total)}</b></div>
                  </div>
                ) : <p className={styles.muted}>{count} prizes · {money(spent) || '$0'}</p>}
                {pool.target_qty !== null && pool.target_total !== null && (needQty ?? 0) > 0 && <p className={styles.dim}>Still needs {needQty} more{budget > 0 ? ` · about ${money(Math.round((budget / (needQty ?? 1)) * 100) / 100)} each left` : ''}</p>}
                {overLines > 0 && <p className={styles.flagWarn}>{overLines} prize{overLines === 1 ? ' is' : 's are'} promised beyond what is in stock.</p>}
                {mine.length > 0 && (
                  <ul className={styles.poolLines}>
                    {groups.map(([type, ls]) => (
                      <li key={`g-${type}`} className={styles.poolGroupItem}>
                        {grouped && <div className={styles.poolGroupHead}><b>{type || 'No type'}</b><span className={styles.dim}>{ls.reduce((n, l) => n + l.quantity, 0)}</span></div>}
                        <ul className={styles.poolLinesInner}>
                          {ls.map((l) => {
                            const p = available.find((x) => x.id === l.prize_id);
                            const similar = swapLine === l.id ? available.filter((x) => x.id !== l.prize_id && x.left > 0 && !mine.some((m) => m.prize_id === x.id) && (l.prize.type && x.type ? x.type.toLowerCase() === l.prize.type.toLowerCase() : Math.abs((x.price ?? 0) - (l.prize.price ?? 0)) <= Math.max(2, (l.prize.price ?? 0) * 0.3))) : [];
                            return (
                              <li key={l.id} className={styles.poolLine}>
                                {swapLine === l.id ? (
                                  <span className={styles.poolLineName}>
                                    <Combo value={null} options={similar.map(label)} placeholder={similar.length ? `Swap ${l.prize.name} for…` : 'No similar prize in stock'} clearable={false} autoFocus ariaLabel={`Swap ${l.prize.name}`} onClose={() => setSwapLine(null)}
                                      onChange={(v) => { const np = similar.find((x) => label(x) === v); if (np && p) void (async () => { await setQty(pool.id, np, l.quantity); await setQty(pool.id, p, 0); })(); }} />
                                  </span>
                                ) : (
                                  <span className={styles.poolLineName}><span><small className={styles.dim}>{l.prize.sponsor ?? 'Club'}</small> <b>{l.prize.name}</b></span><small className={styles.dim}>{[grouped ? null : l.prize.type, l.prize.size, l.prize.price !== null ? money(l.prize.price) : null].filter(Boolean).join(' · ')}{p && !p.in_hand ? `${l.prize.size || l.prize.price !== null ? ' · ' : ''}not here yet` : ''}</small>{l.prize.left < 0 && <small className={styles.flagWarn}>{-l.prize.left} more than in stock</small>}</span>
                                )}
                                <NumberCell value={l.quantity} canEdit={manage && !!p} nullable label={`${l.prize.name} for ${pool.name}`} onSave={(n) => p && void setQty(pool.id, p, n ?? 0)} />
                                <span className={styles.poolLineEnd}>
                                  <span className={`${styles.leftChip} ${l.prize.left < 0 ? styles.leftBad : l.prize.left === 0 ? styles.leftZero : styles.leftOk}`}>{l.prize.left} left</span>
                                  {manage && p && <RowMenu label={`More for ${l.prize.name}`} items={[{ label: 'Swap For A Similar Prize', onClick: () => setSwapLine(l.id) }]} />}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
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
        </>
      )}
      <details className={styles.overview2}>
        <summary>Grid overview</summary>
        <PrizeGrid plan={plan} data={data} />
      </details>
    </div>
  );
}
