'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { confirmHold } from '@/lib/ui/confirmHold';
import BorrowedDialog from './BorrowedDialog';
import { doneKey, type Borrowed, type PlanApi } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

// The devices a sponsor lent or an officer brought for this one event (they are not in the inventory). They are entered and changed here, and they are on the Allocation sheet too, where they
// go through the same steps (with "Returned to owner" at the end). A list on a computer, a card per device on a phone.
export default function BorrowedTab({ plan, catalog, data, kind }: { plan: PlanApi; catalog: LogisticsApi; data: Catalog; kind: 'sponsor' | 'officer' }) {
  const d = plan.detail!;
  const closed = d.plan.status === 'closed';
  const manage = d.canManage && !closed;
  const [dialog, setDialog] = useState<Borrowed | 'new' | null>(null);
  const sponsor = kind === 'sponsor';
  const rows = d.borrowed.filter((b) => b.owner_kind === kind).sort((a, b) => a.owner.localeCompare(b.owner) || a.tag.localeCompare(b.tag, undefined, { numeric: true }));
  const done = new Set(d.done.map(doneKey));
  const back = d.steps.find((s) => s.applies === 'borrowed');
  const station = (id: string | null) => d.stations.find((s) => s.id === id)?.name ?? null;
  async function remove(b: Borrowed) {
    if (!(await confirmHold({ title: `Remove ${b.tag}?`, message: 'It is taken out of this event, with its steps.', confirmLabel: 'Hold to remove' }))) return;
    await plan.act('/borrowed', 'DELETE', { borrowed_id: b.id });
  }
  const noun = sponsor ? 'sponsor loaner' : 'officer loaner';
  return (
    <div className={styles.tab}>
      <div className={styles.toolbarRow}>
        <span className={styles.count}>{rows.length} {noun}{rows.length === 1 ? '' : 's'} for this event</span>
        {manage && <Button className={styles.addBtn} onClick={() => setDialog('new')}>{sponsor ? 'Add Sponsor Loaner' : 'Add Officer Loaner'}</Button>}
      </div>
      {dialog && <BorrowedDialog plan={plan} catalog={catalog} data={data} borrowed={dialog === 'new' ? null : dialog} defaultKind={kind} onClose={() => setDialog(null)} />}
      {rows.length === 0 ? (
        <div className={styles.empty}><p>{sponsor ? 'No sponsor loaners for this event. Add a device a sponsor is lending, then give it a team on the Allocation tab.' : 'No officer loaners for this event. Add a device an officer is bringing, then give it a team on the Allocation tab.'}</p></div>
      ) : (
        <div className={styles.prizeGrid}>
          <div className={`${styles.prizeRow} ${styles.borrowRow} ${styles.prizeHeadRow}`} aria-hidden="true"><span>ID</span><span>Device</span><span>{sponsor ? 'Sponsor' : 'Officer'}</span><span>Team</span><span>Parts</span><span>Status</span><span /></div>
          {rows.map((b) => {
            const returned = back ? done.has(`${b.id}:${back.id}`) : false;
            return (
              <div key={b.id} className={`${styles.prizeRow} ${styles.borrowRow}`}>
                <span className={styles.prizeName}><b>{b.tag}</b></span>
                <span data-label="Device">{b.type}{b.name ? ` · ${b.name}` : ''}</span>
                <span data-label={sponsor ? 'Sponsor' : 'Officer'}>{b.owner}{b.owner_note ? <small className={styles.dim}> · {b.owner_note}</small> : null}</span>
                <span data-label="Team">{station(b.station_id) ?? <span className={styles.warnText}>No team</span>}</span>
                <span data-label="Parts">{b.kit.length ? b.kit.map((k) => `${k.item}${k.qty > 1 ? ` ×${k.qty}` : ''}${k.missing ? ' (missing)' : ''}`).join(', ') : <span className={styles.dim}>–</span>}</span>
                <span data-label="Status">{b.role === 'backup' ? <span className={styles.dim}>{b.swap_reason ? `Swapped out: ${b.swap_reason}` : 'Backup'}</span> : back ? (returned ? <span className={`${styles.statusChip} ${styles.chipOk}`}>Returned</span> : <span className={`${styles.statusChip} ${styles.chipWarn}`}>Not returned</span>) : '–'}</span>
                <span className={styles.prizeTools}>
                  {manage && <button type="button" className={styles.linkBtn} onClick={() => setDialog(b)}>Edit</button>}
                  {manage && <button type="button" className={styles.linkBtn} onClick={() => void remove(b)} aria-label={`Remove ${b.tag}`}>Remove</button>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
