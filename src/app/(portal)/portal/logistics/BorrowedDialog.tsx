'use client';

import { useEffect, useMemo, useState } from 'react';
import Dialog from './Panel';
import { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { BORROWED_KINDS } from '@/lib/logistics/constants';
import { Combo, MultiCombo } from './Combo';
import type { Borrowed, PlanApi, Station } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

// A sponsor's or an officer's device for THIS event only. It is not in the inventory and is fresh each event; its ID only has to be unique within this plan.
export default function BorrowedDialog({ plan, catalog, data, stations, borrowed, defaultKind, onClose }: { plan: PlanApi; catalog: LogisticsApi; data: Catalog; stations: Station[]; borrowed: Borrowed | null; defaultKind?: 'sponsor' | 'officer'; onClose: () => void }) {
  const [tag, setTag] = useState(borrowed?.tag ?? '');
  const [name, setName] = useState(borrowed?.name ?? '');
  const [type, setType] = useState(borrowed?.type ?? '');
  const [kind, setKind] = useState<'sponsor' | 'officer'>(borrowed?.owner_kind ?? defaultKind ?? 'sponsor');
  const [sponsorId, setSponsorId] = useState(borrowed?.sponsor_id ?? '');
  const [officerId, setOfficerId] = useState(borrowed?.owner_user_id ?? '');
  const [note, setNote] = useState(borrowed?.owner_note ?? '');
  const [station, setStation] = useState(borrowed?.station_id ?? '');
  const [parts, setParts] = useState<string[]>(borrowed?.kit.map((k) => k.item) ?? []);
  const [notes, setNotes] = useState(borrowed?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [sponsors, setSponsors] = useState(data.sponsors);

  // The officer picker is fetched only when needed.
  const loadPeople = catalog.loadPeople;
  useEffect(() => { if (kind === 'officer' && !people.length) void loadPeople().then(setPeople); }, [kind, people.length, loadPeople]);
  const peopleLabels = useMemo(() => {
    const seen = new Map<string, number>();
    return people.map((p) => { const n = (seen.get(p.name) ?? 0) + 1; seen.set(p.name, n); return { id: p.id, label: n > 1 ? `${p.name} (${n})` : p.name }; });
  }, [people]);
  const officerName = peopleLabels.find((p) => p.id === officerId)?.label ?? (borrowed?.owner_user_id === officerId ? borrowed?.owner : '') ?? '';
  const sponsorName = sponsors.find((s) => s.id === sponsorId)?.name ?? '';

  async function save() {
    setProblem('');
    if (!tag.trim()) { setProblem('Type the ID it has.'); return; }
    if (!type.trim()) { setProblem('Say what kind of device it is.'); return; }
    setBusy(true);
    const prev = new Map((borrowed?.kit ?? []).map((k) => [k.item.toLowerCase(), k]));
    const body = {
      tag, name, type, owner_kind: kind, sponsor_id: kind === 'sponsor' ? sponsorId || null : null, owner_user_id: kind === 'officer' ? officerId || null : null, owner_note: note, notes, station_id: station || null,
      kit: parts.map((item) => prev.get(item.toLowerCase()) ?? { item, qty: 1, missing: false }),
    };
    const ok = borrowed ? await plan.act('/borrowed', 'PATCH', { borrowed_id: borrowed.id, ...body }) : await plan.act('/borrowed', 'POST', body);
    setBusy(false);
    if (ok) onClose(); else setProblem('That didn’t save. The message at the top of the page says why.');
  }
  async function remove() {
    if (!borrowed || !(await confirmHold({ title: `Remove ${borrowed.tag}?`, message: 'It is taken out of this event, with any steps recorded for it.', confirmLabel: 'Hold to remove' }))) return;
    setBusy(true);
    const ok = await plan.act('/borrowed', 'DELETE', { borrowed_id: borrowed.id });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Dialog title={borrowed ? `Edit ${borrowed.tag}` : 'Add Borrowed Device'} wide busy={busy} onClose={onClose}>
      <div className={styles.form}>
        {problem && <Notice tone="error">{problem}</Notice>}
        <p className={styles.muted}>A sponsor’s or an officer’s device for this event only. It isn’t added to the inventory.</p>
        <div className={styles.row2}>
          <Field label="ID" hint="What it is called at this event. Only has to be unique here."><Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={40} autoFocus={!borrowed} placeholder="S1" autoCapitalize="characters" autoComplete="off" /></Field>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Optional" /></Field>
        </div>
        <Field label="Type" hint="Pick one or type your own."><Combo value={type || null} options={data.lists.type.map((t) => t.value)} onChange={(v) => setType(v ?? '')} onCreate={async (v) => v} clearable={false} placeholder="Choose a type…" /></Field>
        <div className={styles.row2}>
          <Field label="Whose"><Select value={kind} onChange={(e) => setKind(e.target.value as 'sponsor' | 'officer')}>{BORROWED_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select></Field>
          {kind === 'sponsor' ? (
            <Field label="Sponsor"><Combo value={sponsorName || null} options={sponsors.map((s) => s.name)} placeholder="Choose or add…" onChange={(v) => setSponsorId(sponsors.find((s) => s.name === v)?.id ?? '')}
              onCreate={async (v) => { const s = await catalog.saveSponsor(null, { name: v }); if (s) { setSponsors((cur) => (cur.some((x) => x.id === s.id) ? cur : [...cur, s])); setSponsorId(s.id); } return s?.name ?? null; }} /></Field>
          ) : (
            <Field label="Officer"><Combo value={officerName || null} options={peopleLabels.map((p) => p.label)} placeholder="Choose an officer…" onChange={(v) => setOfficerId(peopleLabels.find((p) => p.label === v)?.id ?? '')} /></Field>
          )}
        </div>
        <Field label="Note about the owner" hint="Where to find it or who to ask. Everyone who can open Logistics sees this. Keep phone numbers and emails out."><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
        <Field label="Station"><Select value={station} onChange={(e) => setStation(e.target.value)}><option value="">No station yet</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Parts that come with it" hint="Ticked present or missing at Check done."><MultiCombo values={parts} options={data.lists.kit.map((k) => k.value)} onChange={setParts} onCreate={(v) => catalog.addOption('kit', v)} placeholder="Add a part…" /></Field>
        <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>
      </div>
      <div className={styles.stickyFoot}>
        <DialogActions><DialogCancel onClick={onClose} disabled={busy} /><Button onClick={save} loading={busy}>{borrowed ? 'Save' : 'Add'}</Button></DialogActions>
        {borrowed && <div className={styles.dialogExtra}><Button variant="danger" size="sm" onClick={remove} disabled={busy}>Remove</Button></div>}
      </div>
    </Dialog>
  );
}
