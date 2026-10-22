'use client';

import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input } from '@/components/ui/Field';
import { Combo } from './Combo';
import type { PlanApi, Slim } from './usePlans';
import styles from './logistics.module.css';

const place = (d: Pick<Slim, 'shelf' | 'tier' | 'owner' | 'kind'>) => d.kind === 'club' || d.kind === 'slot' ? ([d.shelf, d.tier].filter(Boolean).join(' · ') || 'No place set') : `${d.kind === 'sponsor' ? 'From' : 'From officer'} ${d.owner ?? 'its owner'}`;

// Swap a device out for another: type the replacement's ID and say why. The device taken out stays on the plan as a backup; the answer shows where to get the replacement.
export default function SwapDialog({ plan, device, options, onClose }: { plan: PlanApi; options: string[]; device: { id: string; tag: string | null; type: string; kind: 'club' | 'sponsor' | 'officer' }; onClose: () => void }) {
  const [tag, setTag] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [got, setGot] = useState<{ replacement: Slim; station: { name: string } | null } | null>(null);

  async function go() {
    if (!tag.trim()) { setProblem('Type the ID of the replacement.'); return; }
    if (!reason.trim()) { setProblem('Say why it is being swapped.'); return; }
    setBusy(true); setProblem('');
    const r = await plan.swap({ ...(device.kind === 'club' ? { device_id: device.id } : { borrowed_id: device.id }), replacement_tag: tag, reason });
    setBusy(false);
    if (!r.ok) setProblem(r.error); else setGot({ replacement: r.replacement, station: r.station });
  }

  if (got) {
    const d = got.replacement;
    return (
      <Dialog title="Swapped" onClose={onClose}>
        <div className={styles.getIt}>
          <span className={styles.getItLabel}>Get {d.tag ?? d.type}{d.kind === 'club' || d.kind === 'slot' ? ' from' : ''}</span>
          <b className={styles.getItPlace}>{place(d)}</b>
          {d.place_note && <span>{d.place_note}</span>}
          {got.station && <span className={styles.getItStation}>Then take it to {got.station.name}.</span>}
        </div>
        <p className={styles.muted}>{device.tag ?? device.type} stays on the plan as a backup.</p>
        <DialogActions><Button onClick={onClose}>Done</Button></DialogActions>
      </Dialog>
    );
  }
  return (
    <Dialog title={`Swap ${device.tag ?? device.type}`} busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <Field label="Replace With" hint={options.length ? `${options.length} ${device.type} available. Type to filter.` : `No spare ${device.type} listed. Type the ID written on the device.`}><Combo value={tag || null} options={options} onChange={(v) => setTag(v ?? '')} onCreate={async (v) => v.trim().toUpperCase()} placeholder="Choose or type an ID" clearable={false} autoFocus ariaLabel="Replacement ID" /></Field>
        <Field label="Why"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Screen flickers" onKeyDown={(e) => { if (e.key === 'Enter') void go(); }} /></Field>
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button onClick={go} loading={busy}><ArrowRightLeft size={15} aria-hidden="true" /> Swap</Button>
      </DialogActions>
    </Dialog>
  );
}
