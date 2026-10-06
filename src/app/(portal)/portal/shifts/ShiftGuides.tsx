'use client';

import { useState } from 'react';
import { BookOpen, Check, ChevronDown, ExternalLink, FileText, MapPin } from 'lucide-react';
import PortalLink from '@/components/portal/PortalLink';
import Button from '@/components/ui/Button';
import EditingNow from '@/components/portal/EditingNow';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { PACIFIC_TZ } from '@/lib/timezone';
import { confirmHold } from '@/lib/confirmHold';
import { cellKey, guideFor, slotCount, slotRange, type ShiftGrid, type ShiftStation, type ShiftTemplate } from '@/lib/shifts';
import styles from './shifts.module.css';

const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
const ARRIVE_EARLY_MS = 30 * 60_000;   // keep in step with api/shifts/[eventId]/arrive

export const catClass = (st: Pick<ShiftStation, 'category'>) => (st.category === 'team' ? styles.catTeam : styles.catGeneral);
export const catName = (st: Pick<ShiftStation, 'category' | 'team_label'>) => (st.category === 'team' ? st.team_label || 'Team' : 'General');

export function Legend({ grid }: { grid: ShiftGrid }) {
  if (!grid.stations.some((s) => s.category === 'team')) return null;
  return (
    <p className={styles.legend}>
      <span><i className={`${styles.dot} ${styles.catGeneral}`} /><span><strong>General</strong>: anyone on the team can sign up</span></span>
      <span><i className={`${styles.dot} ${styles.catTeam}`} /><span><strong>Team shift</strong>: aimed at one team. If that isn’t yours, contact the leads and LE directors before signing up</span></span>
    </p>
  );
}

/** Everything about one station at this event: where, what to do, the script. Anyone who can see shifts can read it. */
export function GuideBody({ grid, station }: { grid: ShiftGrid; station: ShiftStation }) {
  const g = guideFor(station, grid.eventGuides[station.id]);
  const empty = !g.location && !g.instructions && !g.notes && !g.doc_id && !g.link_url;
  return (
    <div className={styles.guide}>
      {g.location && <p className={styles.guideRow}><MapPin size={15} aria-hidden="true" /> <span><strong>Where:</strong> {g.location}</span></p>}
      {g.instructions && <div className={styles.guideText}><h4>What to do</h4><p>{g.instructions}</p></div>}
      {g.notes && <div className={styles.guideText}><h4>For this event</h4><p>{g.notes}</p></div>}
      {(g.doc_id || g.link_url) && (
        <div className={styles.guideLinks}>
          {g.doc_id && <PortalLink href={`/portal/docs?id=${g.doc_id}`} className={styles.guideLink}><FileText size={14} aria-hidden="true" /> {g.doc_title || 'Open the script'}</PortalLink>}
          {g.link_url && <a href={g.link_url} target="_blank" rel="noopener noreferrer" className={styles.guideLink}><ExternalLink size={14} aria-hidden="true" /> {g.link_label || 'Open the link'}</a>}
        </div>
      )}
      {empty && <p className={styles.muted}>Nothing written for this station yet.{grid.canManage ? ' Add it in Setup.' : ''}</p>}
    </div>
  );
}

export function GuideDialog({ grid, station, arrivedNow, onClose }: { grid: ShiftGrid; station: ShiftStation; arrivedNow?: boolean; onClose: () => void }) {
  return (
    <Dialog title={station.name} label={`${station.name} guide`} onClose={onClose}>
      <p className={`${styles.badge} ${catClass(station)}`}>{catName(station)}</p>
      {arrivedNow && <DialogText>You’re checked in. Here’s what to do:</DialogText>}
      <GuideBody grid={grid} station={station} />
      <DialogActions><DialogCancel onClick={onClose}>Close</DialogCancel></DialogActions>
    </Dialog>
  );
}

/** The signed-in person's own shifts: tapping "I'm here" (30 minutes before until the end) checks in and pops the guide up. */
export function MyShifts({ grid, onArrive, onOpen }: { grid: ShiftGrid; onArrive: (stationId: string, slot: number) => Promise<void>; onOpen: (stationId: string) => void }) {
  const plan = grid.plan!;
  const now = Date.now();
  const mine = grid.signups.filter((s) => s.user_id === grid.me).sort((a, b) => a.slot_index - b.slot_index);
  const [busy, setBusy] = useState<string | null>(null);
  if (!mine.length) return null;
  return (
    <section className={styles.card} aria-label="Your shifts">
      <h3 className={styles.h}>Your shifts</h3>
      <ul className={styles.myList}>
        {mine.filter((s) => s.slot_index < slotCount(plan)).map((s) => {
          const st = grid.stations.find((x) => x.id === s.station_id); if (!st) return null;
          const r = slotRange(plan, s.slot_index);
          const canTap = now >= r.start.getTime() - ARRIVE_EARLY_MS && now <= r.end.getTime();
          const over = now > r.end.getTime();
          const key = cellKey(s.station_id, s.slot_index);
          return (
            <li key={key} className={`${styles.myRow} ${catClass(st)}`}>
              <span className={styles.myMain}><strong>{st.name}</strong><span>{time(r.start)} to {time(r.end)}{(() => { const l = guideFor(st, grid.eventGuides[st.id]).location; return l ? ` · ${l}` : ''; })()}</span></span>
              <span className={styles.myActs}>
                {s.arrived_at ? <span className={styles.here}><Check size={14} aria-hidden="true" /> Checked in</span>
                  : !over && <Button size="sm" disabled={!canTap || busy === key} title={canTap ? undefined : 'Opens 30 minutes before the shift'} onClick={async () => { setBusy(key); await onArrive(s.station_id, s.slot_index); setBusy(null); }}><Check size={14} aria-hidden="true" /> I’m here</Button>}
                <Button size="sm" variant="secondary" onClick={() => onOpen(st.id)}><BookOpen size={14} aria-hidden="true" /> Guide</Button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Every station's guide on one page: the master doc for what each shift does. Visible to everyone who can see shifts. One row per station, closed until opened (your own stations start open). */
export function GuidesView({ grid }: { grid: ShiftGrid }) {
  const mine = new Set(grid.signups.filter((x) => x.user_id === grid.me).map((x) => x.station_id));
  const [open, setOpen] = useState<Set<string>>(mine);
  if (!grid.stations.length) return <div className={styles.card}><p className={styles.muted}>There are no stations yet.</p></div>;
  const toggle = (id: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOpen = open.size === grid.stations.length;
  return (
    <div className={styles.guides}>
      <div className={styles.guidesBar}>
        <Legend grid={grid} />
        <button type="button" className={styles.guideBtn} onClick={() => setOpen(allOpen ? new Set() : new Set(grid.stations.map((x) => x.id)))}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
      </div>
      {grid.stations.map((st) => {
        const isOpen = open.has(st.id);
        const g = guideFor(st, grid.eventGuides[st.id]);
        return (
          <section key={st.id} className={`${styles.guideItem} ${catClass(st)}`} aria-label={st.name}>
            <button type="button" className={styles.guideHead} aria-expanded={isOpen} onClick={() => toggle(st.id)}>
              <ChevronDown size={16} className={isOpen ? styles.chevOpen : styles.chev} aria-hidden="true" />
              <span className={styles.guideName}>{st.name}</span>
              <span className={`${styles.badge} ${catClass(st)}`}>{catName(st)}</span>
              {mine.has(st.id) && <span className={styles.youTag}>Your shift</span>}
              {g.location && <span className={styles.guideWhere}><MapPin size={12} aria-hidden="true" /> {g.location}</span>}
            </button>
            {isOpen && <div className={styles.guideBodyWrap}><GuideBody grid={grid} station={st} /></div>}
          </section>
        );
      })}
    </div>
  );
}

type Api = <T = Record<string, unknown>>(url: string, method: string, body?: unknown) => Promise<{ ok: boolean; json: T & { error?: string } }>;
type Docs = { id: string; title: string }[];

const scriptFields = (docs: Docs, v: { doc_id: string; link_url: string; link_label: string }, set: (k: 'doc_id' | 'link_url' | 'link_label', val: string) => void) => (
  <div className={styles.formRow}>
    <Field label="Script (portal doc)"><Select value={v.doc_id} onChange={(e) => set('doc_id', e.target.value)} aria-label="Script doc"><option value="">None</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</Select></Field>
    <Field label="Or a link"><Input value={v.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://" maxLength={500} /></Field>
    {v.link_url.trim() && <Field label="Link name"><Input value={v.link_label} onChange={(e) => set('link_label', e.target.value)} placeholder="Emcee script" maxLength={60} /></Field>}
  </div>
);

/** Setup, exec only: for the event picked above, one short form per station: where it is, what to do (type it, or start from a saved write-up) and the script. */
export function GuideSetup({ grid, stations, docs, templates, setTemplates, eventId, onChanged, setError, api }: {
  grid: ShiftGrid | null; stations: ShiftStation[]; docs: Docs; templates: ShiftTemplate[]; setTemplates: (t: ShiftTemplate[]) => void; eventId: string;
  onChanged: () => Promise<void>; setError: (e: string) => void; api: Api;
}) {
  const [pick, setPick] = useState(stations[0]?.id ?? '');
  const st = stations.find((x) => x.id === pick) ?? stations[0];
  return (
    <div className={styles.guideSetup}>
      <section className={styles.card}>
        <h3 className={styles.h}>Station guide for this event</h3>
        <p className={styles.muted}>For the event picked above: where each station is and what to do. Everyone who can see shifts can read it.</p>
        {stations.length === 0 || !grid ? <p className={styles.muted}>Add a station first (Stations tab).</p> : (
          <>
            <Field label="Station"><Select value={st?.id ?? ''} onChange={(e) => setPick(e.target.value)} aria-label="Station">{stations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
            {st && <GuideForm key={`${eventId}|${st.id}`} station={st} grid={grid} docs={docs} templates={templates} eventId={eventId} api={api} setError={setError} onSaved={onChanged} />}
          </>
        )}
      </section>
      <TemplatesCard templates={templates} setTemplates={setTemplates} setError={setError} api={api} />
    </div>
  );
}

function GuideForm({ station, grid, docs, templates, eventId, api, setError, onSaved }: {
  station: ShiftStation; grid: ShiftGrid; docs: Docs; templates: ShiftTemplate[]; eventId: string; api: Api; setError: (e: string) => void; onSaved: () => Promise<void>;
}) {
  // What is saved for this event, or (for older stations) what was written on the station itself, so nothing already written disappears.
  const g = guideFor(station, grid.eventGuides[station.id]);
  const base = { location: g.location ?? '', text: g.instructions ?? '', doc_id: g.doc_id ?? '', link_url: g.link_url ?? '', link_label: g.link_label ?? '' };
  const [v, setV] = useState(base);
  const [busy, setBusy] = useState(false);
  const dirty = (Object.keys(base) as (keyof typeof base)[]).some((k) => v[k] !== base[k]);
  useUnsavedChanges(dirty ? v : 'CLEAN');
  const set = (k: keyof typeof base, val: string) => setV((prev) => ({ ...prev, [k]: val }));
  async function save() {
    setBusy(true); setError('');
    const r = await api(`/api/shifts/${eventId}/guide`, 'POST', { station_id: station.id, location: v.location, notes: v.text, doc_id: v.doc_id, link_url: v.link_url, link_label: v.link_label });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.'); else await onSaved();
    setBusy(false);
  }
  return (
    <div className={styles.guideForm}>
      <EditingNow room={dirty ? `shifts-guide-${eventId}-${station.id}` : null} what={`the ${station.name} guide`} />
      <Field label="Where"><Input value={v.location} onChange={(e) => set('location', e.target.value)} maxLength={120} placeholder="Front desk, by the entrance" /></Field>
      {templates.length > 0 && (
        <Field label="Start from a saved write-up" hint="Fills in the box below. You can change it after.">
          <Select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) set('text', v.text.trim() ? `${v.text.trim()}\n\n${t.body}` : t.body); }} aria-label="Start from a saved write-up">
            <option value="">Pick one…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="What to do"><Textarea rows={7} value={v.text} onChange={(e) => set('text', e.target.value)} maxLength={4000} placeholder="Step by step: where to stand, who to talk to, what to do if something goes wrong" /></Field>
      {scriptFields(docs, v, (k, val) => set(k, val))}
      <div className={styles.actions}><Button size="sm" onClick={save} disabled={!dirty || busy} loading={busy}>Save</Button></div>
    </div>
  );
}

/** Saved write-ups: pick one on a station to fill in "what to do" (it is copied, so editing the station afterwards does not change the saved one). */
function TemplatesCard({ templates, setTemplates, setError, api }: { templates: ShiftTemplate[]; setTemplates: (t: ShiftTemplate[]) => void; setError: (e: string) => void; api: Api }) {
  const [edits, setEdits] = useState<Record<string, { name?: string; body?: string }>>({});
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  async function add() {
    setBusy('new'); setError('');
    const r = await api<{ template: ShiftTemplate }>('/api/shifts/templates', 'POST', { name, body });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.'); else { setTemplates([...templates, r.json.template]); setName(''); setBody(''); }
    setBusy(null);
  }
  async function save(t: ShiftTemplate) {
    setBusy(t.id); setError('');
    const r = await api<{ template: ShiftTemplate }>('/api/shifts/templates', 'PATCH', { id: t.id, ...edits[t.id] });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.'); else { setTemplates(templates.map((x) => (x.id === t.id ? r.json.template : x))); setEdits(({ [t.id]: _, ...rest }) => rest); }
    setBusy(null);
  }
  async function remove(t: ShiftTemplate) {
    if (!(await confirmHold({ title: `Remove “${t.name}”?`, message: 'Stations that already used it keep their text.', confirmLabel: 'Hold to remove' }))) return;
    setBusy(t.id);
    await api('/api/shifts/templates', 'DELETE', { id: t.id });
    setTemplates(templates.filter((x) => x.id !== t.id)); setBusy(null);
  }
  const dirty = Object.keys(edits).length > 0 || !!name || !!body;
  useUnsavedChanges(dirty ? { edits, name, body } : 'CLEAN');
  return (
    <details className={styles.card}>
      <summary className={styles.templatesSummary}>Saved write-ups ({templates.length})</summary>
      <p className={styles.muted}>Reusable “what to do” text. On a station, choose “Start from a saved write-up” to fill it in, then change what you need.</p>
      {templates.map((t) => {
        const e = edits[t.id];
        return (
          <div key={t.id} className={styles.templateRow}>
            <Input value={e?.name ?? t.name} onChange={(ev) => setEdits((p) => ({ ...p, [t.id]: { ...p[t.id], name: ev.target.value } }))} maxLength={60} aria-label="Write-up name" />
            <Textarea rows={4} value={e?.body ?? t.body} onChange={(ev) => setEdits((p) => ({ ...p, [t.id]: { ...p[t.id], body: ev.target.value } }))} maxLength={4000} aria-label={`${t.name} text`} />
            <div className={styles.actions}>
              <Button size="sm" disabled={!e || busy === t.id} onClick={() => void save(t)}>Save</Button>
              <Button size="sm" variant="danger" disabled={busy === t.id} onClick={() => void remove(t)}>Remove</Button>
            </div>
          </div>
        );
      })}
      <div className={styles.templateRow}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="New write-up name" aria-label="New write-up name" />
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder="What to do" aria-label="New write-up text" />
        <div className={styles.actions}><Button size="sm" disabled={!name.trim() || !body.trim() || busy === 'new'} onClick={() => void add()}>Add write-up</Button></div>
      </div>
    </details>
  );
}
