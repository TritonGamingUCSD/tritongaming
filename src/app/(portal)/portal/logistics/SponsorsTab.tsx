'use client';

import { useState } from 'react';
import Dialog from './Panel';
import { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import type { Catalog, LogisticsApi, Sponsor } from './useLogistics';
import styles from './logistics.module.css';

// The small list of sponsors that lend or give equipment (and later prizes): a name, how to reach them, and a note.
export default function SponsorsTab({ api, data }: { api: LogisticsApi; data: Catalog }) {
  const [editing, setEditing] = useState<Sponsor | 'new' | null>(null);
  return (
    <div className={styles.tab}>
      <div className={styles.toolbarRow}>
        <span className={styles.count}>{data.sponsors.length} {data.sponsors.length === 1 ? 'sponsor' : 'sponsors'}</span>
        {data.canManage && <Button className={styles.addBtn} onClick={() => setEditing('new')}>Add Sponsor</Button>}
      </div>
      {editing && <SponsorDialog api={api} sponsor={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {data.sponsors.length === 0 ? <div className={styles.empty}><p>{data.canManage ? 'No sponsors yet. They are added here, or while adding a sponsor’s device to an event.' : 'No sponsors have been added yet.'}</p></div> : (
        <div className={styles.prizeGrid}>
          <div className={`${styles.prizeRow} ${styles.sponsorRow} ${styles.prizeHeadRow}`} aria-hidden="true"><span>Sponsor</span><span>Contact</span><span>Notes</span><span /></div>
          {data.sponsors.map((s) => (
            <div key={s.id} className={`${styles.prizeRow} ${styles.sponsorRow}`}>
              <span className={styles.prizeName}><b>{s.name}</b></span>
              <span data-label="Contact">{s.contact ?? <span className={styles.dim}>–</span>}</span>
              <span data-label="Notes">{s.notes ?? <span className={styles.dim}>–</span>}</span>
              <span className={styles.prizeTools}>{data.canManage && <button type="button" className={styles.linkBtn} onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>Edit</button>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SponsorDialog({ api, sponsor, onClose }: { api: LogisticsApi; sponsor: Sponsor | null; onClose: () => void }) {
  const [name, setName] = useState(sponsor?.name ?? '');
  const [contact, setContact] = useState(sponsor?.contact ?? '');
  const [notes, setNotes] = useState(sponsor?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  async function save() {
    if (!name.trim()) { setProblem('Type the sponsor’s name.'); return; }
    setBusy(true);
    const s = await api.saveSponsor(sponsor?.id ?? null, { name, contact: contact || null, notes: notes || null });
    setBusy(false);
    if (s) onClose(); else setProblem('That didn’t save. The message at the top of the page says why.');
  }
  async function remove() {
    if (!sponsor || !(await confirmHold({ title: `Remove ${sponsor.name}?`, message: 'They are taken off the sponsor list.', confirmLabel: 'Hold to remove' }))) return;
    setBusy(true);
    const ok = await api.deleteSponsor(sponsor.id);
    setBusy(false);
    if (ok) onClose(); else setProblem('It couldn’t be removed. The message at the top of the page says why.');
  }
  return (
    <Dialog title={sponsor ? 'Edit Sponsor' : 'Add Sponsor'} busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus /></Field>
        <Field label="How to reach them"><Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={300} placeholder="Person, email or phone" /></Field>
        <Field label="Notes"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button onClick={save} loading={busy}>Save</Button>
      </DialogActions>
      {sponsor && <div className={styles.dialogExtra}><Button variant="danger" size="sm" onClick={remove} disabled={busy}>Remove</Button></div>}
    </Dialog>
  );
}
