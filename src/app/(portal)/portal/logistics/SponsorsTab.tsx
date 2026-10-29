'use client';

import { RowMenu } from './RowMenu';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import type { Catalog, LogisticsApi, Sponsor } from './useLogistics';
import { TextCell } from './Cells';
import { GridHead, SPONSOR_COLS, gridStyle } from './gridTable';
import { Plus } from 'lucide-react';
import styles from './logistics.module.css';

// The small list of sponsors that lend or give equipment (and later prizes): a name, how to reach them, and a note. Each is changed right in its row; a new one is added from its name.
export default function SponsorsTab({ api, data }: { api: LogisticsApi; data: Catalog }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const save = (s: Sponsor, patch: Partial<Pick<Sponsor, 'name' | 'contact' | 'notes'>>) => api.saveSponsor(s.id, { name: s.name, contact: s.contact, notes: s.notes, ...patch });
  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const made = await api.saveSponsor(null, { name: name.trim(), contact: null, notes: null });
    setBusy(false);
    if (made) setName('');
  }
  async function remove(s: Sponsor) {
    if (!(await confirmHold({ title: `Remove ${s.name}?`, message: 'They are taken off the sponsor list.', confirmLabel: 'Hold to remove' }))) return;
    await api.deleteSponsor(s.id);
  }
  return (
    <div className={styles.tab}>
      <div className={styles.toolbarRow}>
        <span className={styles.count}>
          {data.sponsors.length} {data.sponsors.length === 1 ? 'sponsor' : 'sponsors'}
        </span>
        {data.canManage && (
          <form
            className={styles.inlineAdd}
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="New sponsor’s name" aria-label="New sponsor’s name" />
            <Button className={styles.addBtn} type="submit" loading={busy} disabled={!name.trim()}>
              <Plus size={15} aria-hidden="true" /> Add<span className={styles.wide}>Sponsor</span>
            </Button>
          </form>
        )}
      </div>
      {data.sponsors.length === 0 ? (
        <div className={styles.empty}>
          <p>{data.canManage ? 'No sponsors yet. They are added here, or while adding a sponsor’s device to an event.' : 'No sponsors have been added yet.'}</p>
        </div>
      ) : (
        <div className={styles.prizeGrid}>
          <GridHead cols={SPONSOR_COLS} />
          {data.sponsors.map((s) => (
            <div key={s.id} className={`${styles.prizeRow} ${styles.sponsorRow}`} style={gridStyle(SPONSOR_COLS)}>
              <span className={styles.prizeName}>
                <TextCell
                  value={s.name}
                  canEdit={data.canManage}
                  strong
                  placeholder="Name"
                  onSave={(v) => {
                    if (v) void save(s, { name: v });
                  }}
                />
              </span>
              <span data-label="Contact">
                <TextCell value={s.contact} canEdit={data.canManage} placeholder="Person, email or phone" max={300} onSave={(v) => void save(s, { contact: v || null })} />
              </span>
              <span data-label="Notes">
                <TextCell value={s.notes} canEdit={data.canManage} placeholder="Add a note" max={1000} onSave={(v) => void save(s, { notes: v || null })} />
              </span>
              <span className={styles.prizeTools}>
                {data.canManage && <RowMenu label={`More for ${s.name}`} items={[{ label: 'Remove', danger: true, onClick: () => void remove(s) }]} />}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
