'use client';

import { useState } from 'react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { MultiCombo, Combo } from './Combo';
import type { PlanApi, Station } from './usePlans';
import type { Catalog } from './useLogistics';
import styles from './logistics.module.css';

// A station is a team's setup: the team (what the sheet calls "For"), a contact, and a room.
export function StationDialog({ plan, station, onClose }: { plan: PlanApi; station: Station | null; onClose: () => void }) {
  const [name, setName] = useState(station?.name ?? '');
  const [contact, setContact] = useState(station?.contact ?? '');
  const [room, setRoom] = useState(station?.room ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const ok = station ? await plan.act('/stations', 'PATCH', { station_id: station.id, name, contact, room }) : await plan.act('/stations', 'POST', { names: name.split(/\n|,/).map((s) => s.trim()).filter(Boolean), contact, room });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog title={station ? 'Edit Team' : 'Add Team'} busy={busy} onClose={onClose}>
      <div className={styles.form}>
        <Field label={station ? 'Team or booth' : 'Team or booth'} hint="Who it is for, like Triton Valorant or Tech Booth."><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={200} /></Field>
        <div className={styles.row2}>
          <Field label="Contact" hint="Who to reach on the day."><Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} placeholder="Discord name or person" /></Field>
          <Field label="Room" hint="Where it goes."><Input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={120} placeholder="East Ballroom" /></Field>
        </div>
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy} disabled={!name.trim()}>Save</Button></DialogActions>
    </Dialog>
  );
}

export function EditPlanDialog({ plan, onClose }: { plan: PlanApi; onClose: () => void }) {
  const p = plan.detail!.plan;
  const [name, setName] = useState(p.name);
  const [starts, setStarts] = useState(p.starts_on);
  const [ends, setEnds] = useState(p.ends_on);
  const [notes, setNotes] = useState(p.notes ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const ok = await plan.act('', 'PATCH', { name, starts_on: starts, ends_on: ends, notes }); setBusy(false); if (ok) onClose(); };
  return (
    <Dialog title="Edit Plan" busy={busy} onClose={onClose}>
      <div className={styles.form}>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <div className={styles.row2}>
          <Field label="First day"><Input type="date" value={starts} onChange={(e) => { setStarts(e.target.value); if (e.target.value > ends) setEnds(e.target.value); }} /></Field>
          <Field label="Last day"><Input type="date" value={ends} min={starts} onChange={(e) => setEnds(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></Field>
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy} disabled={!name.trim() || !starts || !ends}>Save</Button></DialogActions>
    </Dialog>
  );
}

// Add rows to a team: a type (and the games it needs), as many as needed. The device comes later (typed, or picked by "Fill Empty Rows"); a counted thing like a mousepad never gets one.
export function RowDialog({ plan, data, station, onClose }: { plan: PlanApi; data: Catalog; station: Station; onClose: () => void }) {
  const [type, setType] = useState('');
  const [count, setCount] = useState(1);
  const [games, setGames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const allGames = [...new Set([...data.portalGames, ...data.lists.game.map((g) => g.value)])].sort((a, b) => a.localeCompare(b));
  const save = async () => {
    if (!type) { setProblem('Pick what kind of device the row is for.'); return; }
    setBusy(true);
    const ok = await plan.act('/slots', 'POST', { station_id: station.id, type, count, games });
    setBusy(false);
    if (ok) onClose(); else setProblem('That didn’t save. The message at the top of the page says why.');
  };
  return (
    <Dialog title={`Add Rows To ${station.name}`} busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <p className={styles.muted}>A row says what the team needs. Give it a device now or later.</p>
        <div className={styles.row2}>
          <Field label="Device type"><Combo value={type || null} options={data.lists.type.map((t) => t.value)} onChange={(v) => setType(v ?? '')} clearable={false} placeholder="Choose a type…" /></Field>
          <Field label="How many rows"><Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.round(Number(e.target.value)) || 1))} /></Field>
        </div>
        <Field label="Downloads needed" hint="Games or software that must be installed. Optional."><MultiCombo values={games} options={allGames} onChange={setGames} placeholder="Add a game…" /></Field>
      </div>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy}>Add</Button></DialogActions>
    </Dialog>
  );
}

// "Fill Empty Rows": the portal picks a device for each empty row (the ones that need games first get devices that already have them, Working before Not Tested). Preview, then apply.
export function FillDialog({ plan, station, onClose }: { plan: PlanApi; station: Station | null; onClose: () => void }) {
  const [preview, setPreview] = useState<{ slot_id: string; type: string; games: string[]; device: { id: string; tag: string | null; condition: string; games: string[] } | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  async function run(apply: boolean) {
    setBusy(true); setProblem('');
    const r = await plan.fill(station?.id ?? null, apply);
    setBusy(false);
    if (!r.ok) { setProblem(r.error); return; }
    if (apply) onClose(); else setPreview(r.preview);
  }
  const found = preview?.filter((p) => p.device).length ?? 0;
  const missing = preview?.filter((p) => !p.device) ?? [];
  const notTested = preview?.filter((p) => p.device?.condition === 'not_tested').length ?? 0;
  const noGame = preview?.filter((p) => p.device && p.games.some((g) => !p.device!.games.some((x) => x.toLowerCase() === g.toLowerCase()))).length ?? 0;
  return (
    <Dialog title={station ? `Fill Empty Rows: ${station.name}` : 'Fill Empty Rows'} busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        {!preview ? <p className={styles.muted}>The portal will pick a device for every empty row. Nothing changes until you confirm.</p> : (
          <div className={styles.preview} aria-live="polite">
            <p className={styles.previewHead}><b>{found}</b> device{found === 1 ? '' : 's'} found{missing.length ? <span className={styles.warn}> · {missing.length} row{missing.length === 1 ? '' : 's'} left empty (nothing available: {[...new Set(missing.map((m) => m.type))].join(', ')})</span> : null}.</p>
            {notTested > 0 && <p className={styles.muted}>{notTested} {notTested === 1 ? 'is' : 'are'} Not Tested.</p>}
            {noGame > 0 && <p className={styles.warn}>{noGame} {noGame === 1 ? 'doesn’t' : 'don’t'} have the games installed yet.</p>}
            <ul className={styles.pickList}>{preview.filter((p) => p.device).map((p) => <li key={p.slot_id}><b>{p.device!.tag}</b> for {p.type}{p.games.length ? ` (${p.games.join(', ')})` : ''}</li>)}</ul>
          </div>
        )}
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        {preview ? <Button onClick={() => run(true)} loading={busy} disabled={found === 0}>Fill {found} Rows</Button> : <Button onClick={() => run(false)} loading={busy}>Preview</Button>}
      </DialogActions>
    </Dialog>
  );
}
