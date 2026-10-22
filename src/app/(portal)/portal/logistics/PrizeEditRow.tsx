'use client';

import { NumberCell, PickCell, TextCell } from './Cells';
import type { PrizeRow, usePrizes } from './usePrizes';
import type { Catalog, LogisticsApi } from './useLogistics';
import { gridStyle, type Col } from './gridTable';
import styles from './logistics.module.css';

// One prize as a row of boxes: name, sponsor, size, price and how many are changed right in the row (saved when you leave the box). `where` adds the shelf and tier for storage. The rarer fields
// (exact spot, expiry, notes, estimate, remove) are in Details.
export default function PrizeEditRow({ p, prizes, api, data, canEdit, where, sponsorFirst, rowClass, cols, onDetails }: { cols: Col[];
  p: PrizeRow; prizes: ReturnType<typeof usePrizes>; api: LogisticsApi; data: Catalog; canEdit: boolean; where: boolean; sponsorFirst?: boolean; rowClass: string; onDetails: () => void;
}) {
  const save = (patch: Record<string, unknown>) => void prizes.save(p.id, patch);
  const sponsor = data.sponsors.find((s) => s.id === p.sponsor_id)?.name ?? null;
  const sponsorCell = (
    <span data-label="Sponsor">
      <PickCell value={sponsor} shown={sponsor ?? 'Club'} options={data.sponsors.map((s) => s.name)} canEdit={canEdit} onSave={(v) => save({ sponsor_id: data.sponsors.find((s) => s.name === v)?.id ?? null })}
        onCreate={async (v) => { const s = await api.saveSponsor(null, { name: v }); if (s) save({ sponsor_id: s.id }); return s?.name ?? null; }} />
    </span>
  );
  const nameCell = <span className={styles.prizeName}><TextCell value={p.name} canEdit={canEdit} strong onSave={(v) => { if (v) save({ name: v }); }} />{!p.in_hand && (canEdit ? <button type="button" className={styles.miniTextBtn} title="Tick when it has arrived" onClick={() => save({ in_hand: true })}>Not here yet · mark arrived</button> : <small className={styles.flagWarn}>Not here yet</small>)}{p.expires_on && <small className={styles.dim}>expires {p.expires_on}</small>}</span>;
  return (
    <div className={`${rowClass} ${p.left < 0 ? styles.lineBad : ''}`} style={gridStyle(cols)}>
      {sponsorFirst ? <>{sponsorCell}{nameCell}</> : <>{nameCell}{sponsorCell}</>}
      <span data-label="Size"><PickCell value={p.size} shown={p.size ?? 'Big'} options={data.lists.prize_size.map((s) => s.value)} canEdit={canEdit} onSave={(v) => save({ size: v })} onCreate={(v) => api.addOption('prize_size', v)} /></span>
      <span data-label="Type"><TextCell value={p.type} canEdit={canEdit} placeholder="Add" onSave={(v) => save({ type: v })} /></span>
      <span data-label="Price"><NumberCell money nullable step={0.01} value={p.price} canEdit={canEdit} label={`Price of ${p.name}`} onSave={(v) => save({ price: v })} /></span>
      <span data-label="In stock"><NumberCell value={p.quantity} canEdit={canEdit} label={`How many ${p.name}`} onSave={(v) => { if (v !== null) save({ quantity: v }); }} /></span>
      <span data-label="Promised">{p.allocated}</span>
      <span data-label="Given">{p.given}</span>
      <span data-label="Left" className={p.left < 0 ? styles.flagBad : undefined}><b>{p.left}</b></span>
      {where && (
        <span data-label="Where" className={styles.whereCells}>
          <PickCell locate value={p.shelf} options={data.lists.shelf.map((x) => x.value)} canEdit={canEdit} onSave={(v) => save({ shelf: v })} onCreate={(v) => api.addOption('shelf', v)} />
          <PickCell value={p.tier} options={data.lists.tier.map((x) => x.value)} canEdit={canEdit} onSave={(v) => save({ tier: v })} onCreate={(v) => api.addOption('tier', v)} />
        </span>
      )}
      <span className={styles.prizeTools}><button type="button" className={styles.linkBtn} onClick={onDetails}>Details</button></span>
    </div>
  );
}
