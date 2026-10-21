'use client';

import { useMemo, useState } from 'react';
import Dialog from './Panel';
import { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input, Select } from '@/components/ui/Field';
import SectionTabs from '@/components/ui/SectionTabs';
import { MultiCombo } from './Combo';
import type { PickCell, PickPreview, PlanApi, Station } from './usePlans';
import type { Catalog } from './useLogistics';
import styles from './logistics.module.css';


// Add to a plan by bundle ("PC Station ×5": five teams, each with a row for everything in the bundle) or by type ("10 monitors"). Preview first, then add. Devices are chosen for the
// rows (Working and Brand New before Not Tested, devices with the wanted games first); a row with nothing available stays empty to fill later.
export default function PickDialog({ plan, data, stations, onClose }: { plan: PlanApi; data: Catalog; stations: Station[]; onClose: () => void }) {
  const bundles = data.lists.bundle;
  const [mode, setMode] = useState<'bundle' | 'type'>(bundles.length ? 'bundle' : 'type');
  const [bundleId, setBundleId] = useState(bundles[0]?.id ?? '');
  const [type, setType] = useState(data.lists.type.find((t) => t.value === 'Monitor')?.value ?? data.lists.type[0]?.value ?? '');
  const [count, setCount] = useState(1);
  const [stationId, setStationId] = useState('');
  const [games, setGames] = useState<string[]>([]);
  const [preview, setPreview] = useState<PickPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const allGames = useMemo(() => [...new Set([...data.portalGames, ...data.lists.game.map((g) => g.value)])].sort((a, b) => a.localeCompare(b)), [data]);

  const body = (apply: boolean) => ({ ...(mode === 'bundle' ? { bundle_id: bundleId } : { type }), station_id: stationId || undefined, count, games, apply });
  async function run(apply: boolean) {
    setBusy(true); setProblem('');
    const r = await plan.pick(body(apply));
    setBusy(false);
    if (!r.ok) { setProblem(r.error); return; }
    if (apply) onClose(); else setPreview(r.preview);
  }
  const reset = () => setPreview(null);
  const bundle = bundles.find((b) => b.id === bundleId);
  const cells = preview ? preview.stations.flat() : [];
  const found = cells.filter((c) => c.device).length;
  const empty = preview?.empty ?? 0;
  const shortText = !preview ? '' : Array.isArray(preview.short) ? preview.short.map((s) => `${s.missing} more ${s.type}`).join(', ') : preview.short ? `${preview.short} more` : '';
  const cellText = (c: PickCell) => c.device ? `${c.device.tag ?? c.type}${c.device.condition === 'not_tested' ? ' (not tested)' : ''}` : c.counted ? `${c.type} (counted)` : `no ${c.type} available`;

  return (
    <Dialog title="Add Teams And Devices" wide busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <SectionTabs<'bundle' | 'type'> variant="segmented" label="How to choose" value={mode} onChange={(m) => { setMode(m); reset(); }} tabs={[{ id: 'bundle', label: 'By Bundle' }, { id: 'type', label: 'By Type' }]} />
        {mode === 'bundle' ? (
          <>
          <div className={styles.row2}>
            <Field label="Bundle" hint={bundle ? (bundle.items ?? []).map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.type}`).join(' + ') : undefined}>
              <Select value={bundleId} onChange={(e) => { setBundleId(e.target.value); reset(); }}>{bundles.map((b) => <option key={b.id} value={b.id}>{b.value}</option>)}</Select>
            </Field>
            <Field label="How many sets" hint={stationId ? 'All go to the team picked below.' : 'Each set gets a team of its own.'}><Input type="number" min={1} max={40} value={count} onChange={(e) => { setCount(Math.max(1, Math.round(Number(e.target.value)) || 1)); reset(); }} /></Field>
          </div>
          <Field label="Team" hint="Pick a team to add the sets to it, or leave it to make a new team for each set."><Select value={stationId} onChange={(e) => { setStationId(e.target.value); reset(); }}><option value="">A new team for each set</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          </>
        ) : (
          <>
            <div className={styles.row2}>
              <Field label="Type"><Select value={type} onChange={(e) => { setType(e.target.value); reset(); }}>{data.lists.type.map((t) => <option key={t.id} value={t.value}>{t.value}</option>)}</Select></Field>
              <Field label="How many"><Input type="number" min={1} max={500} value={count} onChange={(e) => { setCount(Math.max(1, Math.round(Number(e.target.value)) || 1)); reset(); }} /></Field>
            </div>
            <Field label="Station" hint="Optional. You can move them later."><Select value={stationId} onChange={(e) => setStationId(e.target.value)}><option value="">No station yet</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          </>
        )}
        <Field label="Games that must be playable" hint="Optional. Devices that already have them installed are chosen first; any others are flagged."><MultiCombo values={games} options={allGames} onChange={(g) => { setGames(g); reset(); }} placeholder="Add a game…" /></Field>

        {preview && (
          <div className={styles.preview} aria-live="polite">
            <p className={styles.previewHead}><b>{found}</b> device{found === 1 ? '' : 's'} found{empty > 0 ? <span className={styles.warn}> · {empty} row{empty === 1 ? '' : 's'} left empty{shortText ? ` (short by ${shortText})` : ''}</span> : null}.</p>
            {preview.notTested > 0 && <p className={styles.muted}>{preview.notTested} {preview.notTested === 1 ? 'is' : 'are'} Not Tested (used only after the Working ones ran out).</p>}
            {preview.missingGames > 0 && <p className={styles.warn}>{preview.missingGames} {preview.missingGames === 1 ? 'doesn’t' : 'don’t'} have the games installed yet.</p>}
            {mode === 'bundle' ? (
              <ul className={styles.pickList}>{preview.stations.map((s, i) => <li key={i}><b>{stationId ? `${bundle?.value} set ${i + 1}` : `${bundle?.value} ${i + 1}`}</b> {s.map(cellText).join(', ')}</li>)}</ul>
            ) : (
              <ul className={styles.pickList}>{(preview.stations[0] ?? []).map((c, i) => <li key={i}>{cellText(c)}</li>)}</ul>
            )}
          </div>
        )}
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        {preview ? <Button onClick={() => run(true)} loading={busy} disabled={cells.length === 0}>Add {cells.length} Rows To The Plan</Button> : <Button onClick={() => run(false)} loading={busy} disabled={mode === 'bundle' ? !bundleId : !type}>Preview</Button>}
      </DialogActions>
    </Dialog>
  );
}
