'use client';

import { Combo } from './Combo';
import { NumberCell, TextCell } from './Cells';
import type { PrizeRow, usePrizes } from './usePrizes';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

// One prize as a row of boxes: name, sponsor, size, price and how many are changed right in the row (saved when you leave the box). `where` adds the shelf and tier for storage. The rarer fields
// (exact spot, expiry, notes, estimate, remove) are in Details.
export default function PrizeEditRow({ p, prizes, api, data, canEdit, where, sponsorFirst, rowClass, onDetails }: {
  p: PrizeRow; prizes: ReturnType<typeof usePrizes>; api: LogisticsApi; data: Catalog; canEdit: boolean; where: boolean; sponsorFirst?: boolean; rowClass: string; onDetails: () => void;
}) {
  const save = (patch: Record<string, unknown>) => void prizes.save(p.id, patch);
  const sponsor = data.sponsors.find((s) => s.id === p.sponsor_id)?.name ?? null;
  const sponsorCell = (
    <span data-label="Sponsor" className={styles.cellCombo}>
      <Combo compact value={sponsor} options={data.sponsors.map((s) => s.name)} disabled={!canEdit} placeholder="Club" ariaLabel={`Sponsor of ${p.name}`}
        onChange={(v) => save({ sponsor_id: data.sponsors.find((s) => s.name === v)?.id ?? null })}
        onCreate={async (v) => { const s = await api.saveSponsor(null, { name: v }); if (s) save({ sponsor_id: s.id }); return s?.name ?? null; }} />
    </span>
  );
  const nameCell = <span className={styles.prizeName}><TextCell value={p.name} disabled={!canEdit} label="Prize name" maxLength={160} onSave={(v) => v && save({ name: v })} />{p.expires_on && <small className={styles.dim}>expires {p.expires_on}</small>}</span>;
  return (
    <div className={`${rowClass} ${p.left < 0 ? styles.lineBad : ''}`}>
      {sponsorFirst ? <>{sponsorCell}{nameCell}</> : <>{nameCell}{sponsorCell}</>}
      <span data-label="Size" className={styles.cellCombo}>
        <Combo compact value={p.size} options={data.lists.prize_size.map((s) => s.value)} disabled={!canEdit} placeholder="Big" ariaLabel={`Size of ${p.name}`} onChange={(v) => save({ size: v })} onCreate={(v) => api.addOption('prize_size', v)} />
      </span>
      <span data-label="Price"><NumberCell money step={0.01} value={p.price} disabled={!canEdit} label={`Price of ${p.name}`} onSave={(v) => save({ price: v })} /></span>
      <span data-label="In stock"><NumberCell value={p.quantity} disabled={!canEdit} label={`How many ${p.name}`} onSave={(v) => v !== null && save({ quantity: v })} /></span>
      <span data-label="Promised">{p.allocated}</span>
      <span data-label="Given">{p.given}</span>
      <span data-label="Left" className={p.left < 0 ? styles.flagBad : undefined}><b>{p.left}</b></span>
      {where && (
        <span data-label="Where" className={styles.whereCells}>
          <Combo compact value={p.shelf} options={data.lists.shelf.map((s) => s.value)} disabled={!canEdit} placeholder="Shelf" ariaLabel={`Shelf of ${p.name}`} onChange={(v) => save({ shelf: v })} onCreate={(v) => api.addOption('shelf', v)} />
          <Combo compact value={p.tier} options={data.lists.tier.map((s) => s.value)} disabled={!canEdit} placeholder="Tier" ariaLabel={`Tier of ${p.name}`} onChange={(v) => save({ tier: v })} onCreate={(v) => api.addOption('tier', v)} />
        </span>
      )}
      <span className={styles.prizeTools}><button type="button" className={styles.linkBtn} onClick={onDetails}>Details</button></span>
    </div>
  );
}
