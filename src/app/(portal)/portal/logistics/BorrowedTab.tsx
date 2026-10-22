'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { confirmHold } from '@/lib/ui/confirmHold';
import BorrowedDialog from './BorrowedDialog';
import { ListCell, PickCell, TextCell } from './Cells';
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
  const typeRank = new Map(data.lists.type.map((t, i) => [t.value, i]));   // the Type dropdown's order
  const rows = d.borrowed.filter((b) => b.owner_kind === kind).sort((a, b) => a.owner.localeCompare(b.owner) || (typeRank.get(a.type) ?? 9999) - (typeRank.get(b.type) ?? 9999) || a.tag.localeCompare(b.tag, undefined, { numeric: true }));
  const done = new Set(d.done.map(doneKey));
  const back = d.steps.find((s) => s.applies === 'borrowed');
  const station = (id: string | null) => d.stations.find((s) => s.id === id)?.name ?? null;
  async function remove(b: Borrowed) {
    if (!(await confirmHold({ title: `Remove ${b.tag}?`, message: 'It is taken out of this event, with its steps.', confirmLabel: 'Hold to remove' }))) return;
    await plan.act('/borrowed', 'DELETE', { borrowed_id: b.id });
  }
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const loadPeople = catalog.loadPeople;
  useEffect(() => { if (!sponsor) void loadPeople().then(setPeople); }, [sponsor, loadPeople]);
  const peopleLabels = useMemo(() => { const seen = new Map<string, number>(); return people.map((p) => { const n = (seen.get(p.name) ?? 0) + 1; seen.set(p.name, n); return { id: p.id, label: n > 1 ? `${p.name} (${n})` : p.name }; }); }, [people]);
  const games = useMemo(() => [...new Set([...data.portalGames, ...data.lists.game.map((g) => g.value)])].sort((a, b) => a.localeCompare(b)), [data]);
  const save = (b: Borrowed, body: Record<string, unknown>) => void plan.act('/borrowed', 'PATCH', { borrowed_id: b.id, ...body });
  const noun = sponsor ? 'sponsor loaner' : 'officer loaner';
  return (
    <div className={styles.tab}>
      <div className={styles.toolbarRow}>
        <span className={styles.count}>{rows.length} {noun}{rows.length === 1 ? '' : 's'} for this event</span>
        {manage && <Button className={styles.addBtn} onClick={() => setDialog('new')}>{sponsor ? 'Add Sponsor Loaner' : 'Add Officer Loaner'}</Button>}
      </div>
      {dialog && <BorrowedDialog extrasOnly plan={plan} catalog={catalog} data={data} borrowed={dialog === 'new' ? null : dialog} defaultKind={kind} onClose={() => setDialog(null)} />}
      {rows.length === 0 ? (
        <div className={styles.empty}><p>{sponsor ? 'No sponsor loaners for this event. Add a device a sponsor is lending, then give it a team on the Allocation tab.' : 'No officer loaners for this event. Add a device an officer is bringing, then give it a team on the Allocation tab.'}</p></div>
      ) : (
        <div className={styles.prizeGrid}>
          <div className={`${styles.prizeRow} ${styles.borrowRow} ${styles.prizeHeadRow}`} aria-hidden="true"><span>ID</span><span>Type</span><span>{sponsor ? 'Sponsor' : 'Officer'}</span><span>Station</span><span>Installed games</span><span>Status</span><span /></div>
          {rows.map((b) => {
            const returned = back ? done.has(`${b.id}:${back.id}`) : false;
            return (
              <div key={b.id} className={`${styles.prizeRow} ${styles.borrowRow}`}>
                <span className={styles.prizeName}><TextCell value={b.tag} canEdit={manage} strong onSave={(v) => { if (v) save(b, { tag: v }); }} /></span>
                <span data-label="Type"><PickCell value={b.type} options={data.lists.type.map((t) => t.value)} canEdit={manage} clearable={false} onSave={(v) => { if (v) save(b, { type: v }); }} onCreate={async (v) => v} /></span>
                <span data-label={sponsor ? 'Sponsor' : 'Officer'}>
                  {sponsor
                    ? <PickCell value={b.owner} options={data.sponsors.map((s) => s.name)} canEdit={manage} clearable={false} onSave={(v) => { const sp = data.sponsors.find((s) => s.name === v); if (sp) save(b, { owner_kind: 'sponsor', sponsor_id: sp.id }); }}
                        onCreate={async (v) => { const sp = await catalog.saveSponsor(null, { name: v }); if (sp) save(b, { owner_kind: 'sponsor', sponsor_id: sp.id }); return sp?.name ?? null; }} />
                    : <PickCell value={b.owner} options={peopleLabels.map((p) => p.label)} canEdit={manage} clearable={false} onSave={(v) => { const p = peopleLabels.find((x) => x.label === v); if (p) save(b, { owner_kind: 'officer', owner_user_id: p.id }); }} />}
                </span>
                <span data-label="Station">{station(b.station_id) ?? <span className={styles.dim}>Not in a row yet</span>}</span>
                <span data-label="Installed games"><ListCell values={b.games ?? []} options={games} canEdit={manage} label={`Games on ${b.tag}`} placeholder="Add a game" onSave={(g) => save(b, { games: g })} /></span>
                <span data-label="Status">{b.role === 'backup' ? <span className={styles.dim}>{b.swap_reason ? `Swapped out: ${b.swap_reason}` : 'Backup'}</span> : back ? (returned ? <span className={`${styles.statusChip} ${styles.chipOk}`}>Returned</span> : <span className={`${styles.statusChip} ${styles.chipWarn}`}>Not returned</span>) : '–'}</span>
                <span className={styles.prizeTools}>
                  {manage && <button type="button" className={styles.linkBtn} onClick={() => setDialog(b)}>Details</button>}
                  {manage && <button type="button" className={styles.iconBtn} title="Remove" onClick={() => void remove(b)} aria-label={`Remove ${b.tag}`}><Trash2 size={15} aria-hidden="true" /></button>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
