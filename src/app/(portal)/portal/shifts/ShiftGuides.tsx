'use client';

import { useState } from 'react';
import { BookOpen, Check, ExternalLink, FileText, MapPin } from 'lucide-react';
import PortalLink from '@/components/portal/PortalLink';
import Button from '@/components/ui/Button';
import ColorInput from '@/components/ui/ColorInput';
import EditingNow from '@/components/portal/EditingNow';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { PACIFIC_TZ } from '@/lib/timezone';
import { cellKey, guideFor, slotCount, slotRange, type ShiftGrid, type ShiftStation } from '@/lib/shifts';
import styles from './shifts.module.css';

const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
const ARRIVE_EARLY_MS = 30 * 60_000;   // keep in step with api/shifts/[eventId]/arrive

export const catClass = (st: Pick<ShiftStation, 'category'>) => (st.category === 'team' ? styles.catTeam : styles.catGeneral);
export const catName = (st: Pick<ShiftStation, 'category' | 'team_label'>) => (st.category === 'team' ? st.team_label || 'Team' : 'General');

/** The two colors as CSS variables for everything inside the page. */
export const colorVars = (grid: ShiftGrid | null) => (grid ? ({ '--sh-general': grid.colors.general, '--sh-team': grid.colors.team } as React.CSSProperties) : undefined);

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
      <div style={colorVars(grid)}>
        <p className={`${styles.badge} ${catClass(station)}`}>{catName(station)}</p>
        {arrivedNow && <DialogText>You’re checked in. Here’s what to do:</DialogText>}
        <GuideBody grid={grid} station={station} />
      </div>
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

/** Every station's guide on one page: the master doc for what each shift does. Visible to everyone who can see shifts. */
export function GuidesView({ grid }: { grid: ShiftGrid }) {
  if (!grid.stations.length) return <div className={styles.card}><p className={styles.muted}>There are no stations yet.</p></div>;
  return (
    <div className={styles.guides}>
      <Legend grid={grid} />
      {grid.stations.map((st) => (
        <section key={st.id} className={`${styles.card} ${styles.guideCard} ${catClass(st)}`} aria-label={st.name}>
          <h3 className={styles.h}>{st.name} <span className={`${styles.badge} ${catClass(st)}`}>{catName(st)}</span></h3>
          <GuideBody grid={grid} station={st} />
        </section>
      ))}
    </div>
  );
}

type Api = <T = Record<string, unknown>>(url: string, method: string, body?: unknown) => Promise<{ ok: boolean; json: T & { error?: string } }>;

const linkFields = (docs: { id: string; title: string }[], v: { doc_id: string; link_url: string; link_label: string }, set: (k: 'doc_id' | 'link_url' | 'link_label', val: string) => void) => (
  <>
    <Field label="Script or portal doc" hint="Pick a doc from the portal, such as the emcee script"><Select value={v.doc_id} onChange={(e) => set('doc_id', e.target.value)}>
      <option value="">None</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</Select></Field>
    <Field label="Or an outside link"><Input value={v.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://" maxLength={500} /></Field>
    <Field label="Link label"><Input value={v.link_label} onChange={(e) => set('link_label', e.target.value)} placeholder="Emcee script" maxLength={60} /></Field>
  </>
);

/** Setup, exec only: the colors, each station's standing guide, and what is different for this event. */
export function GuideSetup({ grid, stations, setStations, docs, eventId, onChanged, setError, api }: {
  grid: ShiftGrid | null; stations: ShiftStation[]; setStations: (s: ShiftStation[]) => void; docs: { id: string; title: string }[]; eventId: string;
  onChanged: () => Promise<void>; setError: (e: string) => void; api: Api;
}) {
  const [pick, setPick] = useState(stations[0]?.id ?? '');
  const st = stations.find((s) => s.id === pick) ?? stations[0];
  const colors = grid?.colors;
  async function setColor(k: 'general' | 'team', v: string) {
    const r = await api('/api/shifts/settings', 'PATCH', { [k]: v });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.'); else await onChanged();
  }
  return (
    <section className={styles.card}>
      <h3 className={styles.h}>Station guides</h3>
      <p className={styles.muted}>Each station is also the guide for that job, and everyone who can see shifts can read it. Write what it is once here; use “This event” for the location, notes and script that change each time.</p>
      {colors && (
        <div className={styles.colorRow}>
          <Field label="General shift color"><ColorInput value={colors.general} onChange={(e) => void setColor('general', e.target.value)} aria-label="General shift color" /></Field>
          <Field label="Team shift color"><ColorInput value={colors.team} onChange={(e) => void setColor('team', e.target.value)} aria-label="Team shift color" /></Field>
        </div>
      )}
      {stations.length === 0 ? <p className={styles.muted}>Add a station first.</p> : (
        <>
          <Field label="Station"><Select value={st?.id ?? ''} onChange={(e) => setPick(e.target.value)} aria-label="Station">{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          {st && <StationGuideForm key={st.id} station={st} docs={docs} api={api} setError={setError} onSaved={async (next) => { setStations(stations.map((x) => (x.id === next.id ? next : x))); await onChanged(); }} />}
          {st && grid?.plan && <EventGuideForm key={`${eventId}|${st.id}`} station={st} grid={grid} docs={docs} eventId={eventId} api={api} setError={setError} onSaved={onChanged} />}
        </>
      )}
    </section>
  );
}

function StationGuideForm({ station, docs, api, setError, onSaved }: { station: ShiftStation; docs: { id: string; title: string }[]; api: Api; setError: (e: string) => void; onSaved: (s: ShiftStation) => Promise<void> }) {
  const [v, setV] = useState({ category: station.category, team_label: station.team_label ?? '', location: station.location ?? '', instructions: station.instructions ?? '', doc_id: station.doc_id ?? '', link_url: station.link_url ?? '', link_label: station.link_label ?? '' });
  const [busy, setBusy] = useState(false);
  const dirty = v.category !== station.category || v.team_label !== (station.team_label ?? '') || v.location !== (station.location ?? '') || v.instructions !== (station.instructions ?? '') || v.doc_id !== (station.doc_id ?? '') || v.link_url !== (station.link_url ?? '') || v.link_label !== (station.link_label ?? '');
  useUnsavedChanges(dirty ? v : 'CLEAN');
  async function save() {
    setBusy(true); setError('');
    const r = await api<{ station: ShiftStation }>('/api/shifts/stations', 'PATCH', { id: station.id, ...v });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.'); else await onSaved(r.json.station);
    setBusy(false);
  }
  return (
    <div className={styles.guideForm}>
      <h4>{station.name}: usual guide</h4>
      <EditingNow room={dirty ? `shifts-guide-${station.id}` : null} what={`the ${station.name} guide`} />
      <div className={styles.formRow}>
        <Field label="Who it’s for"><Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as 'general' | 'team' })} aria-label="Who it is for"><option value="general">General: anyone on the team</option><option value="team">A specific team</option></Select></Field>
        {v.category === 'team' && <Field label="Team name" hint="Shown as a label, and in the warning when someone else joins"><Input value={v.team_label} onChange={(e) => setV({ ...v, team_label: e.target.value })} maxLength={40} placeholder="LE" /></Field>}
        <Field label="Usual location"><Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} maxLength={120} placeholder="Front desk, by the entrance" /></Field>
      </div>
      <Field label="What to do"><Textarea rows={5} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} maxLength={4000} placeholder="Step by step: where to stand, who to talk to, what to do if something goes wrong" /></Field>
      <div className={styles.formRow}>{linkFields(docs, v, (k, val) => setV({ ...v, [k]: val }))}</div>
      <div className={styles.actions}><Button size="sm" onClick={save} disabled={!dirty || busy} loading={busy}>Save guide</Button></div>
    </div>
  );
}

function EventGuideForm({ station, grid, docs, eventId, api, setError, onSaved }: { station: ShiftStation; grid: ShiftGrid; docs: { id: string; title: string }[]; eventId: string; api: Api; setError: (e: string) => void; onSaved: () => Promise<void> }) {
  const eg = grid.eventGuides[station.id];
  const [v, setV] = useState({ location: eg?.location ?? '', notes: eg?.notes ?? '', doc_id: eg?.doc_id ?? '', link_url: eg?.link_url ?? '', link_label: eg?.link_label ?? '' });
  const [busy, setBusy] = useState(false);
  const dirty = v.location !== (eg?.location ?? '') || v.notes !== (eg?.notes ?? '') || v.doc_id !== (eg?.doc_id ?? '') || v.link_url !== (eg?.link_url ?? '') || v.link_label !== (eg?.link_label ?? '');
  useUnsavedChanges(dirty ? v : 'CLEAN');
  async function save() {
    setBusy(true); setError('');
    const r = await api(`/api/shifts/${eventId}/guide`, 'POST', { station_id: station.id, ...v });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.'); else await onSaved();
    setBusy(false);
  }
  return (
    <div className={styles.guideForm}>
      <h4>{station.name}: this event</h4>
      <EditingNow room={dirty ? `shifts-guide-${eventId}-${station.id}` : null} what={`the ${station.name} guide for this event`} />
      <p className={styles.muted}>Blank fields use the usual guide above.</p>
      <div className={styles.formRow}>
        <Field label="Location this time"><Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} maxLength={120} placeholder={station.location ?? ''} /></Field>
      </div>
      <Field label="Notes for this event" hint="Shown under the usual instructions"><Textarea rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} maxLength={4000} /></Field>
      <div className={styles.formRow}>{linkFields(docs, v, (k, val) => setV({ ...v, [k]: val }))}</div>
      <div className={styles.actions}><Button size="sm" onClick={save} disabled={!dirty || busy} loading={busy}>Save for this event</Button></div>
    </div>
  );
}
