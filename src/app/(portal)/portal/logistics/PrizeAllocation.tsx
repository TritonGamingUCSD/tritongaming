'use client';

import { Lock, Maximize2, Minimize2 } from 'lucide-react';
import { RowMenu } from './RowMenu';
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import SectionTabs from '@/components/ui/SectionTabs';
import { ANY_SIZE, suggestPrizes } from '@/lib/logistics/prizes';
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
export default function PrizeAllocation({ plan, data, bySponsor, grid, onPrizeView }: { plan: PlanApi; data: Catalog; bySponsor: boolean; grid: boolean; onPrizeView: (v: { bySponsor?: boolean; grid?: boolean }) => void }) {
  const d = plan.detail!;
  const prizes = usePrizes();
  const closed = d.plan.status === 'closed';
  const manage = d.canManage && !closed;
  const { pools, lines } = d.prizes;
  const [poolDialog, setPoolDialog] = useState<(typeof pools)[number] | null>(null);
  const [busy, setBusy] = useState('');
  const [full, setFull] = useState(false);   // the grid fills the whole screen (Esc or the button brings it back)
  useEffect(() => {
    if (!full) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [full]);
  const [swapLine, setSwapLine] = useState<string | null>(null);   // the pool line being swapped for a similar prize
  const [short, setShort] = useState<Record<string, string>>({});   // what a Suggest could not find in stock, in words
  const sponsorName = useMemo(() => new Map(data.sponsors.map((s) => [s.id, s.name])), [data.sponsors]);
  const available = useMemo(() => (prizes.rows ?? []).filter((p) => !p.plan_id || p.plan_id === d.plan.id), [prizes.rows, d.plan.id]);
  const summary = (p: PrizeRow) => ({ id: p.id, name: p.name, sponsor: sponsorName.get(p.sponsor_id ?? '') ?? null, size: p.size, type: p.type, price: p.price, quantity: p.quantity, quantity_is_estimate: p.quantity_is_estimate, in_hand: p.in_hand, left: p.left });

  async function setQty(poolId: string, p: PrizeRow, n: number) {
    const r = await plan.setPrizeLine(poolId, summary(p), Math.max(0, Math.round(n)));
    if (r.ok && r.delta) prizes.bump(p.id, r.delta);
  }
  const isLocked = (pool: (typeof pools)[number]) => !!pool.request_id && (d.lockedRequests ?? []).includes(pool.request_id);
  // Prizes set aside on purpose for future events. They stay in this event's stock until the event is closed and they are moved to inventory by hand.
  const keepsOn = d.plan.manual_return !== false;
  const canKeep = d.canManage;   // also after the event is closed: that is when kept prizes are moved
  const keeps = d.prizes.keeps ?? [];
  const inPlan = useMemo(() => { const m = new Map<string, (typeof lines)[number]['prize']>(); for (const l of lines) m.set(l.prize_id, l.prize); return m; }, [lines]);
  // A prize that has run out in this event (all of it given out on the day) has nothing left to keep, so it is not offered.
  const giveSteps = new Set(d.prizes.steps.filter((x) => x.gives).map((x) => x.id));
  const givenOf = (lineId: string, qty: number) => Math.min(qty, d.prizes.done.filter((x) => x.line_id === lineId && giveSteps.has(x.step_id)).reduce((n, x) => n + x.done, 0));
  const leftInEvent = (prizeId: string) => lines.filter((l) => l.prize_id === prizeId).reduce((n, l) => n + l.quantity - givenOf(l.id, l.quantity), 0);
  const keepable = [...inPlan].filter(([id]) => !keeps.some((k) => k.prize_id === id) && leftInEvent(id) > 0);
  const keepLabel = (prize: (typeof lines)[number]['prize']) => `${prize.sponsor ?? 'Club'} · ${prize.name}${prize.type ? ` · ${prize.type}` : ''}${prize.size ? ` · ${prize.size}` : ''}`;
  const pending = keeps.filter((k) => !k.moved_at);
  async function moveKept(prizeId?: string) {
    const ok = await plan.act('/keeps', 'PATCH', prizeId ? { prize_id: prizeId } : {});
    if (ok) void prizes.reload();
  }
  const sizeOrder = data.lists.prize_size.map((o) => o.value);
  const haveOf = (poolId: string) => lines.filter((l) => l.pool_id === poolId).reduce<Record<string, number>>((m, l) => (l.prize.size ? { ...m, [l.prize.size]: (m[l.prize.size] ?? 0) + l.quantity } : m), {});
  // What a pool still needs of each size to reach what its request asked for.
  // A request can also ask for a count of any size: that is what its total has beyond the sizes it named, and prizes beyond a size's own count (or with no size) go toward it.
  const anyOf = (pool: (typeof pools)[number]) => {
    const target = pool.target_sizes ?? {}, have = haveOf(pool.id);
    const want = Math.max(0, (pool.target_qty ?? 0) - Object.values(target).reduce((n, x) => n + x, 0));
    const got = lines.filter((l) => l.pool_id === pool.id).reduce((n, l) => n + l.quantity, 0) - Object.entries(have).reduce((n, [z, x]) => n + Math.min(x, target[z] ?? 0), 0);
    return { want, got };
  };
  const needOf = (pool: (typeof pools)[number]) => {
    const have = haveOf(pool.id), any = anyOf(pool);
    const out: Record<string, number> = Object.fromEntries(Object.entries(pool.target_sizes ?? {}).map(([z, n]) => [z, Math.max(0, n - (have[z] ?? 0))]).filter(([, n]) => (n as number) > 0));
    if (any.want - any.got > 0) out[ANY_SIZE] = any.want - any.got;
    return out;
  };
  const needText = (need: Record<string, number>) => [...sizeOrder, ANY_SIZE].filter((z) => need[z]).map((z) => `${need[z]} ${z === ANY_SIZE ? 'of any size' : z}`).join(', ');
  // `used` is what other pools already took in the same go (Fill All), so two pools never take the last of a prize.
  async function suggest(pool: (typeof pools)[number], used: Map<string, number> = new Map()) {
    setBusy(pool.id);
    const { picks, short: missing } = suggestPrizes(available.filter((p) => p.in_hand).map((p) => ({ id: p.id, size: p.size, left: p.left - (used.get(p.id) ?? 0), sponsor: !!p.sponsor_id })), needOf(pool));
    for (const [id, n] of picks) used.set(id, (used.get(id) ?? 0) + n);
    for (const [id, n] of picks) {
      const p = available.find((x) => x.id === id);
      if (!p) continue;
      const have = lines.find((l) => l.pool_id === pool.id && l.prize_id === id)?.quantity ?? 0;
      await setQty(pool.id, p, have + n);
    }
    setShort((c) => ({ ...c, [pool.id]: needText(missing) }));
    setBusy('');
  }

  // Fill every pool that still needs prizes, one after another.
  async function fillAll() {
    const used = new Map<string, number>();
    for (const pool of pools) if (!isLocked(pool) && Object.keys(needOf(pool)).length > 0) await suggest(pool, used);
  }
  const needy = pools.filter((pool) => !isLocked(pool) && Object.keys(needOf(pool)).length > 0).length;

  if (!prizes.rows) return <div className={styles.tab}><p className={styles.muted}>Loading…</p></div>;
  return (
    <div className={styles.tab}>
      {poolDialog && <PoolDialog plan={plan} pool={poolDialog} onClose={() => setPoolDialog(null)} />}
      {pools.length === 0 ? (
        <div className={styles.empty}><p>No prize requests yet. A request for prizes makes a card here for its team.</p></div>
      ) : (
        <>
        <div className={styles.toolbarRow}>
          <SectionTabs<'cards' | 'grid'> variant="segmented" label="How to show the prizes" value={grid ? 'grid' : 'cards'} onChange={(v) => onPrizeView({ grid: v === 'grid', bySponsor })} tabs={[{ id: 'cards', label: 'Cards' }, { id: 'grid', label: 'Grid' }]} />
          {!grid && <SectionTabs<'type' | 'sponsor'> variant="segmented" label="Group the prizes by" value={bySponsor ? 'sponsor' : 'type'} onChange={(v) => onPrizeView({ bySponsor: v === 'sponsor' })} tabs={[{ id: 'type', label: 'By Type' }, { id: 'sponsor', label: 'By Sponsor' }]} />}
          {!grid && manage && needy > 1 && <><Button size="sm" variant="secondary" loading={!!busy} onClick={() => void fillAll()}>Fill All {needy} Pools</Button><span className={`${styles.muted} ${styles.wide}`}>Suggests prizes for every pool that still needs some, sponsor prizes first.</span></>}
        </div>
        {grid ? (
          <div className={full ? styles.gridFull : undefined}>
            <div className={styles.gridFullBar}>
              <button type="button" className={styles.linkBtn} onClick={() => setFull((v) => !v)} aria-pressed={full}>{full ? <><Minimize2 size={14} aria-hidden="true" /> Exit Full Screen</> : <><Maximize2 size={14} aria-hidden="true" /> Full Screen</>}</button>
            </div>
            <PrizeGrid plan={plan} data={data} />
          </div>
        ) : (
        <div className={styles.poolCards}>
          {pools.map((pool) => {
            const locked = !!pool.request_id && (d.lockedRequests ?? []).includes(pool.request_id);   // its request's allocation is locked
            const canEdit = manage && !locked;
            const mine = lines.filter((l) => l.pool_id === pool.id);
            const count = mine.reduce((n, l) => n + l.quantity, 0);
            const spent = Math.round(mine.reduce((n, l) => n + l.quantity * (l.prize.price ?? 0), 0) * 100) / 100;
            const need = needOf(pool);
            const have = haveOf(pool.id);
            const needCount = Object.values(need).reduce((n, x) => n + x, 0);
            const any = anyOf(pool);
            // A size shows when the request named it; a size it didn't name only shows (as over) when there is no any-size count for it to go toward.
            const tiers = sizeOrder.filter((z) => (pool.target_sizes?.[z] ?? 0) > 0 || ((have[z] ?? 0) > 0 && any.want === 0));
            const addable = available.filter((p) => p.left > 0 && !mine.some((l) => l.prize_id === p.id));
            const label = (p: PrizeRow) => `${sponsorName.get(p.sponsor_id ?? '') ?? 'Club'} · ${p.name}${p.type ? ` · ${p.type}` : ''}${p.size ? ` · ${p.size}` : ''}${p.price !== null ? ` · ${money(p.price)}` : ''} · ${p.left} left${p.in_hand ? '' : ' · not here yet'}`;
            const overLines = mine.filter((l) => l.prize.left < 0).length;
            const groups = (() => { const g = new Map<string, typeof mine>(); for (const l of mine) { const k = (bySponsor ? l.prize.sponsor ?? 'Club' : l.prize.type) ?? ''; g.set(k, [...(g.get(k) ?? []), l]); } return [...g].sort((a, b) => (a[0] === '' ? 1 : 0) - (b[0] === '' ? 1 : 0) || a[0].localeCompare(b[0])); })();
            const grouped = bySponsor || groups.some(([k]) => k !== '');
            const countState = pool.target_qty === null ? '' : count === pool.target_qty ? styles.barOk : count > pool.target_qty ? styles.barBad : styles.barWarn;
            return (
              <section key={pool.id} className={styles.poolCard} aria-label={pool.name}>
                <header className={styles.poolCardHead}>
                  <div className={styles.poolTitle}>
                    <b>{pool.name}</b>{locked && <span className={styles.lockTag} title="Locked in its request. Unlock it there to change this pool."><Lock size={12} aria-hidden="true" /> Locked</span>}
                    {pool.station_id && <span className={styles.dim}>{d.stations.find((s) => s.id === pool.station_id)?.name}</span>}
                  </div>
                  {canEdit && <RowMenu label={`More for ${pool.name}`} items={[{ label: 'Edit', onClick: () => setPoolDialog(pool) }]} />}
                </header>
                {pool.target_qty !== null ? (
                  <div className={styles.poolGoal}>
                    <div className={styles.goalLine}><span>Prizes</span><b className={countState === styles.barBad ? styles.flagBad : undefined}>{count} / {pool.target_qty}</b></div>
                    <div className={`${styles.bar} ${countState}`}><i style={{ width: `${Math.min(100, pool.target_qty ? (count / pool.target_qty) * 100 : 0)}%` }} /></div>
                    {tiers.map((z) => { const want = pool.target_sizes?.[z] ?? 0, got = have[z] ?? 0; return <div key={z} className={styles.goalLine}><span>{z}</span><b className={got > want ? styles.flagBad : got === want ? styles.okText : undefined}>{got} / {want}</b></div>; })}
                    {any.want > 0 && <div className={styles.goalLine}><span>Any size</span><b className={any.got > any.want ? styles.flagBad : any.got === any.want ? styles.okText : undefined}>{any.got} / {any.want}</b></div>}
                  </div>
                ) : <p className={styles.muted}>{count} prizes · {money(spent) || '$0'}</p>}
                {needCount > 0 && <p className={`${styles.dim} ${styles.goalNeed}`}>Still needs {needText(need)}</p>}
                {overLines > 0 && <p className={styles.flagWarn}>{overLines} prize{overLines === 1 ? ' is' : 's are'} promised beyond what is in stock.</p>}
                {mine.length > 0 && (
                  <ul className={styles.poolLines}>
                    {groups.map(([type, ls]) => (
                      <li key={`g-${type}`} className={styles.poolGroupItem}>
                        {grouped && <div className={styles.poolGroupHead}><b>{type || (bySponsor ? 'Club' : 'No type')}</b><span className={styles.dim}>{ls.reduce((n, l) => n + l.quantity, 0)}</span></div>}
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
                                  <span className={styles.poolLineName}><span>{!bySponsor && <><small className={styles.dim}>{l.prize.sponsor ?? 'Club'}</small>{' '}</>}<b>{l.prize.name}</b></span><small className={styles.dim}>{[grouped && !bySponsor ? null : l.prize.type, l.prize.size, l.prize.price !== null ? money(l.prize.price) : null].filter(Boolean).join(' · ')}{p && !p.in_hand ? `${l.prize.size || l.prize.price !== null ? ' · ' : ''}not here yet` : ''}</small>{l.prize.left < 0 && <small className={styles.flagWarn}>{-l.prize.left} more than in stock</small>}</span>
                                )}
                                <NumberCell value={l.quantity} canEdit={canEdit && !!p} nullable label={`${l.prize.name} for ${pool.name}`} onSave={(n) => p && void setQty(pool.id, p, n ?? 0)} />
                                <span className={styles.poolLineEnd}>
                                  <span className={`${styles.leftChip} ${l.prize.left < 0 ? styles.leftBad : l.prize.left === 0 ? styles.leftZero : styles.leftOk}`}>{l.prize.left} left</span>
                                  {canEdit && p && <RowMenu label={`More for ${l.prize.name}`} items={[{ label: 'Swap For A Similar Prize', onClick: () => setSwapLine(l.id) }]} />}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
                {short[pool.id] && <p className={styles.flagWarn}>Not enough in stock for {short[pool.id]}.</p>}
                {canEdit && (
                  <div className={styles.poolFoot}>
                    <div className={styles.poolAdd}>
                      <Combo value={null} options={addable.map(label)} placeholder="Add a prize…" clearable={false} ariaLabel={`Add a prize to ${pool.name}`} onChange={(v) => { const p = addable.find((x) => label(x) === v); if (p) void setQty(pool.id, p, 1); }} />
                    </div>
                    {needCount > 0 && <Button size="sm" variant="secondary" loading={busy === pool.id} onClick={() => void suggest(pool)}>Suggest {needCount}</Button>}
                  </div>
                )}
              </section>
            );
          })}
          {keepsOn && (
            <section className={styles.poolCard} aria-label="Keep for future events">
              <header className={styles.poolCardHead}><div className={styles.poolTitle}><b>Keep For Future</b><span className={styles.dim}>Set aside on purpose for later events</span></div></header>
              <p className={`${styles.dim} ${styles.goalNeed}`}>{closed ? 'Nothing goes back to stock by itself. Move what you are keeping to inventory.' : 'Putting a prize here changes nothing yet: it can still be used during the event. After the event is closed you move what is left to inventory.'}</p>
              {keeps.length > 0 && (
                <ul className={styles.poolLinesInner}>
                  {keeps.map((k) => {
                    const prize = inPlan.get(k.prize_id);
                    return (
                      <li key={k.prize_id} className={styles.poolLine}>
                        <span className={styles.poolLineName}><span><small className={styles.dim}>{prize?.sponsor ?? 'Club'}</small> <b>{prize?.name ?? 'Prize'}</b></span><small className={styles.dim}>{[prize?.type, prize?.size].filter(Boolean).join(' · ')}</small></span>
                        <NumberCell value={k.quantity} canEdit={canKeep && !k.moved_at} label={`How many ${prize?.name ?? 'prizes'} to keep`} onSave={(n) => { if (n && n > 0) void plan.act('/keeps', 'POST', { prize_id: k.prize_id, quantity: n }); }} />
                        <span className={styles.poolLineEnd}>
                          {k.moved_at ? <span className={`${styles.leftChip} ${styles.leftOk}`}>In inventory</span> : <span className={`${styles.leftChip} ${styles.leftZero}`}>Kept</span>}
                          {canKeep && !k.moved_at && <RowMenu label={`More for ${prize?.name ?? 'prize'}`} items={[closed && { label: 'Move To Inventory', onClick: () => void moveKept(k.prize_id) }, { label: 'Remove From Keep List', danger: true, onClick: () => void plan.act('/keeps', 'DELETE', { prize_id: k.prize_id }) }]} />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {canKeep && (
                <div className={styles.poolFoot}>
                  <div className={styles.poolAdd}>
                    <Combo value={null} options={keepable.map(([, p]) => keepLabel(p))} placeholder={keepable.length ? 'Keep a prize…' : 'No prizes left to keep in this event'} clearable={false} ariaLabel="Keep a prize for future events" onChange={(v) => { const hit = keepable.find(([, p]) => keepLabel(p) === v); if (hit) void plan.act('/keeps', 'POST', { prize_id: hit[0], quantity: 1 }); }} />
                  </div>
                  {closed && pending.length > 0 && <Button size="sm" variant="secondary" onClick={() => void moveKept()}>Move {pending.length === 1 ? '' : `All ${pending.length} `}To Inventory</Button>}
                </div>
              )}
            </section>
          )}
        </div>
        )}
        </>
      )}
    </div>
  );
}
