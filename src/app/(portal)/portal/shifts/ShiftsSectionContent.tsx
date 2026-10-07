'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CalendarClock, Check, Eye, GripVertical, Loader2, MapPin, Printer, LayoutGrid, Pencil, Plus, Settings2, Trash2, UserPlus, Users, X } from 'lucide-react';
import SectionHeader from '@/components/ui/SectionHeader';
import PortalLink from '@/components/portal/PortalLink';
import SectionTabs from '@/components/ui/SectionTabs';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import SaveBar from '@/components/portal/SaveBar';
import EditingNow from '@/components/portal/EditingNow';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { DateTimeInput, Field, Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/confirmHold';
import { createClient } from '@/lib/supabase/client';
import { PACIFIC_TZ } from '@/lib/timezone';
import { usePortalTabSync, useUrlNav } from '@/lib/usePortalTabSync';
import { useLiveParams } from '@/lib/usePortalParams';
import { useVisiblePoll } from '@/lib/useVisiblePoll';
import { useDragReorder } from '@/lib/useDragReorder';
import { SLOT_CHOICES, awayDuring, cellKey, groupByArea, guideFor, neededFor, slotCount, slotRange, type ShiftGrid, type ShiftStation, type ShiftTemplate } from '@/lib/shifts';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import GapsPanel, { gapsOf } from './ShiftGaps';
import CoverPanel from './ShiftCover';
import { GuideDialog, GuideSetup, GuidesView, Legend, MyShifts, catClass, catName } from './ShiftGuides';
import type { ShiftEvent } from './getShiftsData';
import styles from './shifts.module.css';

type Tab = 'signup' | 'schedule' | 'guides' | 'people' | 'setup';
const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' });
// <input type="datetime-local"> works in the browser's own zone; shifts are always shown in Pacific time like the rest of the portal.
const toLocalInput = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

async function api<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<{ ok: boolean; json: T & { error?: string } }> {
  try {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    return { ok: res.ok, json: await res.json().catch(() => ({})) };
  } catch { return { ok: false, json: { error: 'Network error. Try again.' } as T & { error?: string } }; }
}

export default function ShiftsSectionContent({ events, stations: initialStations, docs, templates: initialTemplates, canManage, canSignUp, userId, userName }: {
  events: ShiftEvent[]; stations: ShiftStation[]; docs: { id: string; title: string }[]; templates: ShiftTemplate[]; canManage: boolean; canSignUp: boolean; userId: string; userName: string;
}) {
  const nav = useUrlNav();
  const sync = usePortalTabSync('shifts', () => tabs[0]);
  // Signup-capable people get the grid and the by-time list as two views of one tab; people who can only look get the by-time list as the Schedule tab.
  const tabs: Tab[] = [...(canSignUp ? (['signup', 'guides'] as Tab[]) : (['schedule', 'guides'] as Tab[])), ...(canManage ? (['people', 'setup'] as Tab[]) : [])];
  const wanted = (nav.tab === 'board' || nav.tab === 'schedule') && canSignUp ? 'signup' : nav.tab === 'board' ? 'schedule' : nav.tab;
  const [tab, setTab] = useState<Tab>(tabs.includes(wanted as Tab) ? (wanted as Tab) : tabs[0]);
  const [view, setViewState] = useState<'grid' | 'time'>(nav.tab === 'signup' && nav.subtab === 'time' || ((nav.tab === 'board' || nav.tab === 'schedule') && canSignUp) ? 'time' : 'grid');
  const setView = (v: 'grid' | 'time') => { setViewState(v); sync('signup', v === 'grid' ? null : 'time'); };
  // A link can name the event (and a station whose guide should open): the dashboard's "Open guide" uses ?event=<id>&guide=<station id>.
  const liveParams = useLiveParams();
  const wantedEvent = liveParams.get('event');
  const [eventId, setEventId] = useState<string | null>(() => (wantedEvent && events.some((e) => e.id === wantedEvent) ? wantedEvent : events.find((e) => e.plan?.signup_open)?.id ?? events[0]?.id ?? null));
  const [stations, setStations] = useState(initialStations);
  const [templates, setTemplates] = useState(initialTemplates);
  const [grid, setGrid] = useState<ShiftGrid | null>(null);
  const [error, setError] = useState('');
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [busyAct, setBusyAct] = useState<'join' | 'leave' | null>(null);   // what the person is doing in the busy cell, so the grid can say so while it saves
  const [viewers, setViewers] = useState<string[]>([]);
  const gridRef = useRef<ShiftGrid | null>(null); gridRef.current = grid;

  const load = useCallback(async () => {
    if (!eventId) return;
    const r = await api<{ grid: ShiftGrid }>(`/api/shifts/${eventId}`, 'GET');
    if (r.ok && r.json.grid) { const g = r.json.grid as ShiftGrid; setStations(g.stations); setGrid({ ...g, canManage: g.canManage && canManage, canSignUp: g.canSignUp && canSignUp }); }   // an admin previewing a lower role sees only what that role could use
    else if (!r.ok) setError(r.json.error || 'Couldn’t load the shifts.');
  }, [eventId]);
  useEffect(() => { setGrid(null); setError(''); void load(); }, [load]);
  // The board stays live without polling: the server sends a "changed" message to this event's channel after every shift change (see the effect
  // below), and the page refreshes then. A slow refresh remains as a backstop in case the connection is blocked; it pauses while the tab is hidden.
  const loadRef = useRef(load); loadRef.current = load;
  useVisiblePoll(load, 60_000);

  // Who else is looking at this event right now.
  useEffect(() => {
    if (!eventId) return;
    const supabase = createClient();
    const channel = supabase.channel(`shifts:${eventId}`, { config: { presence: { key: userId } } });
    let pending: ReturnType<typeof setTimeout> | undefined;
    let joined = false;
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, { name?: string }[]>;
      setViewers(Object.entries(state).filter(([k]) => k !== userId).map(([, v]) => v[0]?.name ?? 'Someone'));
    }).on('broadcast', { event: 'changed' }, () => {
      clearTimeout(pending);   // several changes close together make one refresh
      pending = setTimeout(() => { if (!document.hidden) void loadRef.current(); }, 250);
    }).subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await channel.track({ name: userName });
      if (joined) void loadRef.current();   // reconnected: catch up on anything missed
      joined = true;
    });
    // Changes to the stations list (add, rename, reorder, area, team) affect every event, so they come on one shared channel.
    const shared = supabase.channel('shifts:stations');
    shared.on('broadcast', { event: 'changed' }, () => { clearTimeout(pending); pending = setTimeout(() => { if (!document.hidden) void loadRef.current(); }, 250); }).subscribe();
    return () => { clearTimeout(pending); void supabase.removeChannel(channel); void supabase.removeChannel(shared); };
  }, [eventId, userId, userName]);

  const ev = events.find((e) => e.id === eventId) ?? null;
  const myAwayNeeds = grid?.absences.filter((a) => a.user_id === userId).map((a) => a.needs) ?? [];
  const myNeeds = myAwayNeeds.length ? Math.min(...myAwayNeeds) : null;
  const plan = grid?.plan ?? ev?.plan ?? null;

  // Joining a team shift asks first: it is a warning, not a block (the person may well be on that team).
  const [warn, setWarn] = useState<{ station: ShiftStation; slot: number } | null>(null);
  const [guideOpen, setGuideOpen] = useState<{ id: string; arrived?: boolean } | null>(null);
  const openedFromLink = useRef(false);
  useEffect(() => {
    const g = liveParams.get('guide');
    if (!openedFromLink.current && g && grid?.stations.some((x) => x.id === g)) { openedFromLink.current = true; setGuideOpen({ id: g }); }
  }, [grid, liveParams]);
  function tryClaim(stationId: string, slot: number, join: boolean) {
    const st = grid?.stations.find((x) => x.id === stationId);
    if (join && st?.category === 'team') { setWarn({ station: st, slot }); return; }
    void claim(stationId, slot, join);
  }
  async function arrive(stationId: string, slot: number) {
    setError('');
    const r = await api(`/api/shifts/${eventId}/arrive`, 'POST', { station_id: stationId, slot_index: slot });
    if (!r.ok) { setError(r.json.error || 'Couldn’t save that.'); return; }
    await load();
    setGuideOpen({ id: stationId, arrived: true });
  }
  async function claim(stationId: string, slot: number, join: boolean) {
    const key = cellKey(stationId, slot);
    setBusyCell(key); setBusyAct(join ? 'join' : 'leave'); setError('');
    const r = await api(`/api/shifts/${eventId}/signup`, 'POST', { station_id: stationId, slot_index: slot, join });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.');
    await load();
    setBusyCell(null); setBusyAct(null);
  }

  async function tick(itemId: string, done: boolean) {
    setError('');
    const r = await api(`/api/shifts/${eventId}/checklist`, 'POST', { item_id: itemId, done });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.');
    await load();
  }

  // Swap and cover: ask / take / withdraw / undo. Errors show in the page's usual error line; the grid refreshes either way.
  async function coverAct(body: Record<string, unknown>): Promise<boolean> {
    setError('');
    const r = await api(`/api/shifts/${eventId}/cover`, 'POST', body);
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.');
    await load();
    return r.ok;
  }

  const [placing, setPlacing] = useState<{ station: string; slot: number } | null>(null);
  async function place(stationId: string, slot: number, who: string, join: boolean) {
    const key = cellKey(stationId, slot);
    setBusyCell(key); setError('');
    const r = await api(`/api/shifts/${eventId}/signup`, 'POST', { station_id: stationId, slot_index: slot, join, user_id: who });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.');
    await load();
    setBusyCell(null);
  }

  if (events.length === 0) {
    return (
      <div className={styles.page}>
        <SectionHeader title="Shifts" sub="Who works which station, and when" />
        <p className={styles.empty}>There are no upcoming events to staff yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SectionHeader title="Shifts" sub="Who works which station, and when" />
      {tabs.length > 1 && (
        <SectionTabs<Tab> label="Shifts" value={tab} onChange={(t) => { setTab(t); sync(t); }}
          tabs={tabs.map((t) => (t === 'signup' ? { id: t, label: 'Sign up', icon: <CalendarClock size={14} /> } : t === 'schedule' ? { id: t, label: 'Schedule', icon: <LayoutGrid size={14} /> } : t === 'guides' ? { id: t, label: 'Guides', icon: <BookOpen size={14} /> } : t === 'people' ? { id: t, label: 'People', icon: <Users size={14} /> } : { id: t, label: 'Setup', icon: <Settings2 size={14} /> }))} />
      )}
      <div className={styles.topRow}>
        <Field label="Event">
          <Select value={eventId ?? ''} onChange={(e) => setEventId(e.target.value)} aria-label="Event">
            {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {dayLabel(e.start_date)}{e.plan ? (e.plan.signup_open ? ' · signup open' : ' · signup not open yet') : ''}</option>)}
          </Select>
        </Field>
        {plan && eventId && (
          <a className={styles.printLink} href={`/print/shifts/${eventId}`} target="_blank" rel="noopener noreferrer"><Printer size={14} aria-hidden="true" /> Print sheet</a>
        )}
        {plan && tab === 'signup' && (
          <div className={styles.viewToggle}>
            <SectionTabs<'grid' | 'time'> label="View" variant="segmented" value={view} onChange={setView} tabs={[{ id: 'grid', label: 'Grid' }, { id: 'time', label: 'By time' }]} />
          </div>
        )}
        {viewers.length > 0 && <p className={styles.viewers} role="status"><Eye size={14} aria-hidden="true" /> {viewers.slice(0, 3).join(', ')}{viewers.length > 3 ? ` +${viewers.length - 3}` : ''} looking now</p>}
      </div>


      {error && <Notice tone="error">{error}</Notice>}

      {!plan && tab !== 'setup' && (
        <div className={styles.card}><p className={styles.muted}>{canManage ? 'No shifts are set up for this event yet. Open the Setup tab to make the grid.' : 'No shifts have been set up for this event yet.'}</p></div>
      )}

      {plan && tab === 'signup' && (
        <>
          {!plan.signup_open && (
            <Notice tone="warning"><strong>Signup is not open yet.</strong> {canManage ? 'Only exec and admins can put people on shifts until it opens (open it in Setup).' : 'You can look at the grid now; the Join buttons switch on when exec opens signup.'}</Notice>
          )}
          {grid && !!plan.min_per_person && (
            <p className={styles.mine}>
              <strong>Your shifts: {grid.signups.filter((x) => x.user_id === grid.me).length}/{myNeeds ?? plan.min_per_person}</strong>
              <span>{grid?.exemptions.length ? 'You are exempt from the requirement this event, but you can still sign up.' : myNeeds !== null ? 'Fewer for you, since you are away for part of it.' : `Active officers and leads take at least ${plan.min_per_person}.`}</span>
            </p>
          )}
          {grid && <Legend grid={grid} />}
          {grid && <CoverPanel grid={grid} onAct={coverAct} />}
          {grid && <MyShifts grid={grid} onArrive={arrive} onOpen={(id) => setGuideOpen({ id })} />}
          {grid && view === 'grid' && <GridView grid={grid} busyCell={busyCell} busyAct={busyAct} onClaim={tryClaim} onGuide={(id) => setGuideOpen({ id })} onPlace={(station, slot) => setPlacing({ station, slot })} />}
          {grid && view === 'time' && <BoardView grid={grid} />}
          {grid && view === 'grid' && placing && canManage && <PlaceBar grid={grid} placing={placing} busy={busyCell === cellKey(placing.station, placing.slot)} onPlace={place} onClose={() => setPlacing(null)} />}
        </>
      )}
      {plan && tab === 'schedule' && grid && <><Legend grid={grid} /><MyShifts grid={grid} onArrive={arrive} onOpen={(id) => setGuideOpen({ id })} /><BoardView grid={grid} /></>}
      {plan && tab === 'guides' && grid && <GuidesView grid={grid} onTick={tick} />}
      {!plan && tab === 'guides' && <div className={styles.card}><p className={styles.muted}>Guides show up once the shifts for this event are set up.</p></div>}
      {plan && tab === 'people' && grid && canManage && <PeopleView event={ev!} sync={sync} initial={nav.tab === 'people' ? nav.subtab : undefined} grid={grid} onChanged={load} setError={setError} />}
      {!plan && tab === 'people' && <div className={styles.card}><p className={styles.muted}>Make the grid in Setup first, then you can see who has their shifts.</p></div>}
      {warn && (
        <Dialog title="This is a team shift" onClose={() => setWarn(null)}>
          <DialogText>{warn.station.name} is meant for {warn.station.team_label || 'one team'}. If you’re not on that team, please contact the leads and LE directors before signing up.</DialogText>
          <DialogActions><DialogCancel onClick={() => setWarn(null)} /><Button onClick={() => { const w = warn; setWarn(null); void claim(w.station.id, w.slot, true); }}>Sign up anyway</Button></DialogActions>
        </Dialog>
      )}
      {guideOpen && grid && grid.stations.find((x) => x.id === guideOpen.id) && <GuideDialog grid={grid} station={grid.stations.find((x) => x.id === guideOpen.id)!} arrivedNow={guideOpen.arrived} onTick={tick} onClose={() => setGuideOpen(null)} />}
      {tab === 'setup' && canManage && ev && (
        <SetupView event={ev} sync={sync} initial={nav.tab === 'setup' ? nav.subtab : undefined} docs={docs} templates={templates} setTemplates={setTemplates} grid={grid} stations={stations} setStations={setStations} onChanged={load} setError={setError} />
      )}
    </div>
  );
}

function useCellNames(grid: ShiftGrid) {
  return useMemo(() => {
    const m = new Map<string, ShiftGrid['signups']>();
    for (const s of grid.signups) m.set(cellKey(s.station_id, s.slot_index), [...(m.get(cellKey(s.station_id, s.slot_index)) ?? []), s]);
    return m;
  }, [grid.signups]);
}

// Time slots down the side, stations across the top. A cell shows who is on it and how many are still needed.
function GridView({ grid, busyCell, busyAct, onClaim, onGuide, onPlace }: {
  grid: ShiftGrid; busyCell?: string | null; busyAct?: 'join' | 'leave' | null; onClaim?: (station: string, slot: number, join: boolean) => void; onGuide?: (station: string) => void; onPlace?: (station: string, slot: number) => void;
}) {
  const plan = grid.plan!;
  const slots = slotCount(plan);
  const names = useCellNames(grid);
  const mySlots = new Set(grid.signups.filter((s) => s.user_id === grid.me).map((s) => s.slot_index));
  const myAway = grid.absences.filter((a) => a.user_id === grid.me);
  if (grid.stations.length === 0) return <div className={styles.card}><p className={styles.muted}>There are no stations yet. Exec can add them in Setup.</p></div>;
  const open = grid.canSignUp && (grid.canManage || plan.signup_open);
  return (
    <div className={styles.areas}>
      {groupByArea(grid.stations).map((group) => (
        <section key={group.key} className={styles.area} aria-label={group.label || 'Stations'}>
          {group.label && <h3 className={styles.areaHead}>{group.label}</h3>}
          <div className={styles.gridWrap}>
      <table className={styles.grid} style={{ minWidth: `${120 + group.stations.length * 88}px` }}>
        <thead>
          <tr>
            <th scope="col" className={styles.corner}>Time</th>
            {group.stations.map((st) => {
              const loc = guideFor(st, grid.eventGuides[st.id]).location;
              return (
                <th key={st.id} scope="col" className={`${styles.slotHead} ${styles.stationHead} ${styles.catHead} ${catClass(st)}`}>
                  {st.name}
                  <span className={styles.headMeta}>
                    <span className={`${styles.badge} ${catClass(st)}`}>{catName(st)}</span>
                    {onGuide && <button type="button" className={styles.guideBtn} onClick={() => onGuide(st.id)}><BookOpen size={12} aria-hidden="true" /> Guide</button>}
                  </span>
                  {loc && <span className={styles.stationLoc}><MapPin size={11} aria-hidden="true" /> {loc}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: slots }, (_, i) => {
            const r = slotRange(plan, i);
            const away = awayDuring(myAway, r);
            return (
              <tr key={i}>
                <th scope="row" className={`${styles.stationName} ${styles.gridTime}`}>{time(r.start)} – {time(r.end)}</th>
                {group.stations.map((st) => {
                  const key = cellKey(st.id, i);
                  const here = names.get(key) ?? [];
                  const needed = neededFor(grid, st.id, i);
                  const mine = here.some((h) => h.user_id === grid.me);
                  const full = here.length >= needed;
                  const clash = !mine && mySlots.has(i);
                  const saving = busyCell === key;
                  const adding = saving && busyAct === 'join';
                  const leaving = saving && busyAct === 'leave';
                  const disabled = busyCell === key || needed === 0 || !open || (!mine && (full || clash || away));
                  return (
                    <td key={st.id} className={`${styles.cell} ${catClass(st)} ${saving ? styles.cellSaving : ''} ${mine ? styles.cellMine : ''} ${needed === 0 ? styles.cellNone : full ? styles.cellFull : here.length === 0 ? styles.cellEmpty : styles.cellPart}`}>
                      <button type="button" className={styles.cellBtn} disabled={disabled} aria-busy={saving || undefined}
                        onClick={() => onClaim?.(st.id, i, !mine)}>
                        <span className={styles.srOnly}>{st.name}, {time(r.start)}.{mine ? ' You are on this shift.' : ''}{away && !mine ? ' You are away then.' : ''} </span>
                        <span className={styles.count}>{here.length}/{needed}</span>
                        <span className={styles.chips}>
                          {here.map((h) => { const gone = leaving && h.user_id === grid.me; return <span key={h.id} className={`${styles.chip} ${h.user_id === grid.me ? styles.chipMe : ''} ${gone ? styles.chipLeaving : ''}`}>{h.name}{gone && <><Loader2 size={11} className={styles.spin} aria-hidden="true" /> removing…</>}</span>; })}
                          {adding && <span className={`${styles.chip} ${styles.chipPending}`} role="status"><Loader2 size={11} className={styles.spin} aria-hidden="true" /> adding you…</span>}
                        </span>
                        {!disabled && <span className={styles.act}>{mine ? 'Leave' : 'Join'}</span>}
                        {saving && !adding && !leaving && <Loader2 size={13} className={styles.spin} aria-label="Saving" />}
                        {away && !mine && needed > 0 && <span className={styles.awayTag}>Away</span>}
                      </button>
                      {/* Exec and admins can put anyone on a shift, or take them off, even before signup opens: the small button opens the panel at the bottom. */}
                      {grid.canManage && onPlace && needed > 0 && (
                        <button type="button" className={styles.placeBtn} onClick={() => onPlace(st.id, i)} aria-label={`Add or remove someone: ${st.name}, ${time(r.start)}`} title="Add or remove someone"><UserPlus size={13} aria-hidden="true" /></button>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
          </div>
        </section>
      ))}
    </div>
  );
}

// Exec: put someone on the chosen cell, or take them off. Sticks to the bottom so it stays in view while you look at the grid.
function PlaceBar({ grid, placing, busy, onPlace, onClose }: { grid: ShiftGrid; placing: { station: string; slot: number }; busy: boolean; onPlace: (station: string, slot: number, who: string, join: boolean) => void; onClose: () => void }) {
  const st = grid.stations.find((x) => x.id === placing.station);
  const plan = grid.plan!;
  const names = useCellNames(grid);
  const here = names.get(cellKey(placing.station, placing.slot)) ?? [];
  const needed = neededFor(grid, placing.station, placing.slot);
  const [who, setWho] = useState('');
  if (!st) return null;
  const r = slotRange(plan, placing.slot);
  return (
    <div className={styles.placeBar} role="dialog" aria-label="Add or remove people">
      <div className={styles.placeHead}>
        <strong>{st.name}</strong><span>{time(r.start)} to {time(r.end)} · {here.length}/{needed}</span>
        <button type="button" className={styles.placeClose} onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
      </div>
      <div className={styles.placeBody}>
        <div className={styles.placePeople}>
          {here.length === 0 && <span className={styles.muted}>Nobody yet.</span>}
          {here.map((h) => <span key={h.id} className={styles.chip}>{h.name}<button type="button" onClick={() => onPlace(placing.station, placing.slot, h.user_id, false)} aria-label={`Take ${h.name} off`} disabled={busy}><X size={11} aria-hidden="true" /></button></span>)}
        </div>
        <div className={styles.placeAdd}>
          <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who to add">
            <option value="">Pick someone…</option>
            {grid.roster.filter((p) => !here.some((h) => h.user_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Button size="sm" disabled={!who || busy} onClick={() => { onPlace(placing.station, placing.slot, who, true); setWho(''); }}><Plus size={14} aria-hidden="true" /> Add</Button>
        </div>
      </div>
    </div>
  );
}

// The schedule: one block per time slot, each station with its people, and what is still empty.
function BoardView({ grid }: { grid: ShiftGrid }) {
  const plan = grid.plan!;
  const slots = slotCount(plan);
  const names = useCellNames(grid);
  const nowIdx = (() => { const t = Date.now(); for (let i = 0; i < slots; i++) { const r = slotRange(plan, i); if (t >= r.start.getTime() && t < r.end.getTime()) return i; } return -1; })();
  let missing = 0;
  for (const st of grid.stations) for (let i = 0; i < slots; i++) missing += Math.max(0, neededFor(grid, st.id, i) - (names.get(cellKey(st.id, i))?.length ?? 0));
  return (
    <div className={styles.board}>
      <p className={styles.summary}><Users size={15} aria-hidden="true" /> {grid.signups.length} signed up · {missing === 0 ? 'every shift is covered' : `${missing} spot${missing === 1 ? '' : 's'} still open`}</p>
      {Array.from({ length: slots }, (_, i) => {
        const r = slotRange(plan, i);
        return (
          <section key={i} className={`${styles.slotCard} ${i === nowIdx ? styles.slotNow : ''}`} aria-label={`${time(r.start)} to ${time(r.end)}`}>
            <h3 className={styles.slotTitle}>{time(r.start)} – {time(r.end)}{i === nowIdx && <span className={styles.nowTag}>Now</span>}</h3>
            <ul className={styles.slotList}>
              {groupByArea(grid.stations).map((group) => {
                const rows = group.stations.map((st) => {
                const here = names.get(cellKey(st.id, i)) ?? [];
                const needed = neededFor(grid, st.id, i);
                if (needed === 0 && here.length === 0) return null;
                return (
                  <li key={st.id}>
                    <strong className={styles.boardStation}><i className={`${styles.dot} ${catClass(st)}`} /> {st.name}</strong>
                    <span className={here.length >= needed ? styles.ok : styles.short}>{here.length}/{needed}</span>
                    <span className={styles.who}>{here.length ? here.map((h, k) => <span key={h.id}>{k > 0 && ', '}{h.name}{h.arrived_at && <Check size={12} className={styles.arrivedMark} aria-label="checked in" />}</span>) : 'nobody yet'}</span>
                  </li>
                );
              });
                const shown = rows.filter(Boolean);
                if (!shown.length) return null;
                return <Fragment key={group.key}>{group.label && <li className={styles.areaLi}>{group.label}</li>}{shown}</Fragment>;
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// Who has taken the shifts they need. Active officers and leads each have a requirement; the ones still short come first, and inactive (exempt) officers are listed apart.
function PeopleView({ event, sync, initial, grid, onChanged, setError }: { event: ShiftEvent; sync: (tab: string, subtab?: string | null) => void; initial?: string; grid: ShiftGrid; onChanged: () => Promise<void>; setError: (e: string) => void }) {
  const r = grid.requirement;
  const [show, setShow] = useState<'owe' | 'all'>('owe');
  const [sub, setSubState] = useState<'requirement' | 'exempt' | 'away' | 'gaps'>(initial === 'exempt' || initial === 'away' || initial === 'gaps' ? initial : 'requirement');
  const setSub = (v: 'requirement' | 'exempt' | 'away' | 'gaps') => { setSubState(v); sync('people', v === 'requirement' ? null : v); };
  const subTabs = (
    <SectionTabs<'requirement' | 'exempt' | 'away' | 'gaps'> label="People" variant="segmented" value={sub} onChange={setSub}
      tabs={[{ id: 'requirement', label: 'Requirement' }, { id: 'gaps', label: 'Gaps', count: gapsOf(grid).reduce((n, x) => n + x.gaps.reduce((m, g) => m + g.open, 0), 0) }, { id: 'exempt', label: 'Exempt', count: grid.exemptions.length + (r?.exempt.filter((p) => p.reason === 'inactive').length ?? 0) }, { id: 'away', label: 'Away', count: grid.absences.length }]} />
  );
  if (sub === 'gaps') return <div className={styles.people}>{subTabs}<GapsPanel grid={grid} onPlace={async (stationId, slot, who) => { const r = await api(`/api/shifts/${event.id}/signup`, 'POST', { station_id: stationId, slot_index: slot, join: true, user_id: who }); if (!r.ok) setError(r.json.error || 'Couldn’t add them.'); await onChanged(); }} /></div>;
  if (sub === 'exempt') return (
    <div className={styles.people}>
      {subTabs}
      {r && (
        <div className={styles.card}>
          <h3 className={styles.h}>Who has no requirement</h3>
          <p className={styles.muted}>Inactive officers and anyone exempted for this event have no requirement but can still sign up. Inactive status is set each quarter in <PortalLink href="/portal/quarters">Quarters</PortalLink>.</p>
          {r.exempt.length === 0 && <p className={styles.muted}>Nobody is exempt right now.</p>}
          <ul className={styles.peopleList}>{r.exempt.map((p) => <li key={p.id}><span className={styles.pName}>{p.name}<span className={styles.awayTag}>{p.reason === 'event' ? (p.note ?? 'This event') : 'Inactive'}</span></span><span className={styles.muted}>{p.count} shift{p.count === 1 ? '' : 's'}</span></li>)}</ul>
        </div>
      )}
      <ExemptPanel event={event} grid={grid} onChanged={onChanged} setError={setError} />
    </div>
  );
  if (sub === 'away') return <div className={styles.people}>{subTabs}<AwayPanel event={event} grid={grid} onChanged={onChanged} setError={setError} /></div>;
  if (!r) return <div className={styles.people}>{subTabs}<div className={styles.card}><p className={styles.muted}>No shift requirement is set for this event. Set one in Setup (“Shift requirement”) and this page lists who still owes shifts.</p></div></div>;
  const owe = r.people.filter((p) => p.count < p.need);
  const done = r.people.length - owe.length;
  const list = show === 'owe' ? owe : r.people;
  return (
    <div className={styles.people}>
      {subTabs}
      <div className={styles.tiles}>
        <div className={styles.tile}><strong>{done}</strong><span>have their shifts</span></div>
        <div className={`${styles.tile} ${owe.length ? styles.tileWarn : ''}`}><strong>{owe.length}</strong><span>still owe shifts</span></div>
        <div className={styles.tile}><strong>{r.exempt.length}</strong><span>exempt</span></div>
        <div className={styles.tile}><strong>{r.min}</strong><span>shifts each, at least</span></div>
      </div>
      <div className={styles.card}>
        <div className={styles.listHead}>
          <h3 className={styles.h}>{show === 'owe' ? (owe.length ? 'Still owe shifts' : 'Everyone has their shifts') : 'Everyone with a requirement'}</h3>
          <SectionTabs<'owe' | 'all'> label="Show" variant="segmented" value={show} onChange={setShow} tabs={[{ id: 'owe', label: `Still owe ${owe.length}` }, { id: 'all', label: `All ${r.people.length}` }]} />
        </div>
        <ul className={styles.peopleList}>
          {list.map((p) => {
            const ok = p.count >= p.need;
            return (
              <li key={p.id}>
                <span className={styles.pName}>{p.name}{p.absent && <span className={styles.awayTag}>Away part of it</span>}</span>
                <span className={styles.bar} role="img" aria-label={`${p.count} of ${p.need} shifts`}><span className={`${styles.barFill} ${ok ? styles.barOk : ''}`} style={{ width: `${p.need === 0 ? 100 : Math.min(100, (p.count / p.need) * 100)}%` }} /></span>
                <span className={ok ? styles.ok : styles.short}>{p.count}/{p.need}</span>
              </li>
            );
          })}
          {list.length === 0 && <li className={styles.muted}>Nobody to show.</li>}
        </ul>
      </div>
    </div>
  );
}

function SetupView({ event, sync, initial, docs, templates, setTemplates, grid, stations, setStations, onChanged, setError }: {
  event: ShiftEvent; sync: (tab: string, subtab?: string | null) => void; initial?: string; docs: { id: string; title: string }[]; templates: ShiftTemplate[]; setTemplates: (t: ShiftTemplate[]) => void; grid: ShiftGrid | null; stations: ShiftStation[]; setStations: (s: ShiftStation[]) => void; onChanged: () => Promise<void>; setError: (e: string) => void;
}) {
  const plan = grid?.plan ?? event.plan;
  // Remounting on a changed plan gives the form a fresh starting point, so what is on screen is always what is saved until someone edits it.
  const sig = plan ? `${plan.starts_at}|${plan.ends_at}|${plan.slot_minutes}|${plan.min_per_person ?? ''}` : 'none';
  const [busy, setBusy] = useState(false);

  async function setSignup(open: boolean) {
    if (!plan) return;
    setBusy(true); setError('');
    const r = await api(`/api/shifts/${event.id}/plan`, 'PUT', { starts_at: plan.starts_at, ends_at: plan.ends_at, slot_minutes: plan.slot_minutes, signup_open: open, team_only: true, min_per_person: plan.min_per_person });
    if (!r.ok) setError(r.json.error || 'Couldn’t save.');
    await onChanged(); setBusy(false);
  }
  async function removePlan() {
    if (!(await confirmHold({ title: 'Remove the shifts for this event?', message: 'The grid and everyone’s signups are deleted.', confirmLabel: 'Hold to remove' }))) return;
    setBusy(true);
    await api(`/api/shifts/${event.id}/plan`, 'DELETE');
    await onChanged(); setBusy(false);
  }

  // Three small pages instead of one long one: this event's basics, the stations and their numbers, and the station guides.
  const [part, setPartState] = useState<'event' | 'stations' | 'guides'>(initial === 'stations' || initial === 'guides' ? initial : 'event');
  const setPart = (v: 'event' | 'stations' | 'guides') => { setPartState(v); sync('setup', v === 'event' ? null : v); };
  return (
    <div className={styles.setup}>
      <SectionTabs<'event' | 'stations' | 'guides'> label="Setup" variant="segmented" value={part} onChange={setPart}
        tabs={[{ id: 'event', label: 'This event' }, { id: 'stations', label: 'Stations' }, { id: 'guides', label: 'Guides' }]} />
      {part === 'event' && <GridBasics key={`${event.id}|${sig}`} event={event} grid={grid} onChanged={onChanged} setError={setError} />}

      {part === 'event' && plan && (
        <section className={styles.card}>
          <h3 className={styles.h}>Signup</h3>
          <Toggle on={plan.signup_open} onChange={(v) => void setSignup(v)} label="Signup" busy={busy}
            onText="Open: officers and leads can join shifts now" offText="Closed: only exec and admins can add people until you switch it on" />
        </section>
      )}

      {part === 'stations' && <StationSheet event={event} grid={grid} stations={stations} setStations={setStations} onChanged={onChanged} setError={setError} />}

      {part === 'guides' && <GuideSetup grid={grid} stations={stations} docs={docs} templates={templates} setTemplates={setTemplates} eventId={event.id} onChanged={onChanged} setError={setError} api={api} />}

      {part === 'event' && plan && (
        <section className={`${styles.card} ${styles.dangerCard}`}>
          <h3 className={styles.h}>Remove the shifts</h3>
          <p className={styles.muted}>Deletes this event’s grid and every signup on it. Stations stay.</p>
          <div className={styles.actions}><Button variant="danger" onClick={removePlan} disabled={busy}><Trash2 size={14} aria-hidden="true" /> Remove shifts</Button></div>
        </section>
      )}
    </div>
  );
}

// The basics of the grid (when it runs, how long a slot is, the requirement). With a grid in place they are read-only until someone presses Edit,
// and changes only count once Save changes is pressed (the bar at the bottom), so one stray click cannot move everyone's shifts.
function GridBasics({ event, grid, onChanged, setError }: { event: ShiftEvent; grid: ShiftGrid | null; onChanged: () => Promise<void>; setError: (e: string) => void }) {
  const plan = grid?.plan ?? event.plan;
  const defStart = plan?.starts_at ?? event.start_date;
  const defEnd = plan?.ends_at ?? event.end_date ?? new Date(new Date(event.start_date).getTime() + 4 * 3_600_000).toISOString();
  const [editing, setEditing] = useState(!plan);
  const [startsAt, setStartsAt] = useState(toLocalInput(defStart));
  const [endsAt, setEndsAt] = useState(toLocalInput(defEnd));
  const [slotMinutes, setSlotMinutes] = useState(plan?.slot_minutes ?? 60);
  const [minPer, setMinPer] = useState(plan?.min_per_person ? String(plan.min_per_person) : '');
  const [busy, setBusy] = useState(false);
  const form = { startsAt, endsAt, slotMinutes, minPer };
  const { dirty, markSaved, saved } = useUnsavedChanges(form);
  const signups = grid?.signups.length ?? 0;

  async function save() {
    const timeChanged = !!plan && (new Date(startsAt).toISOString() !== new Date(plan.starts_at).toISOString() || new Date(endsAt).toISOString() !== new Date(plan.ends_at).toISOString() || slotMinutes !== plan.slot_minutes);
    if (timeChanged && signups > 0 && !(await confirmHold({ title: 'Change when the shifts run?', message: `${signups} signup${signups === 1 ? ' is' : 's are'} already on this grid. People keep their clock time where the new slots line up with it. Anyone whose time no longer lines up, or falls outside the new range, is taken off.`, confirmLabel: 'Hold to change' }))) return;
    setBusy(true); setError('');
    const r = await api(`/api/shifts/${event.id}/plan`, 'PUT', {
      starts_at: new Date(startsAt).toISOString(), ends_at: new Date(endsAt).toISOString(), slot_minutes: slotMinutes, signup_open: plan?.signup_open ?? false, team_only: true,
      min_per_person: minPer.trim() === '' ? null : Number(minPer),
    });
    if (!r.ok) { setError(r.json.error || 'Couldn’t save.'); setBusy(false); return; }
    markSaved(); setEditing(false);
    await onChanged(); setBusy(false);
  }
  function discard() { const v = saved(); setStartsAt(v.startsAt); setEndsAt(v.endsAt); setSlotMinutes(v.slotMinutes); setMinPer(v.minPer); setEditing(false); }

  const dt = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (plan && !editing) {
    return (
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.h}>The grid for {event.title}</h3>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /> Edit basics</Button>
        </div>
        <dl className={styles.facts}>
          <div><dt>Starts</dt><dd>{dt(plan.starts_at)}</dd></div>
          <div><dt>Ends</dt><dd>{dt(plan.ends_at)}</dd></div>
          <div><dt>Slot length</dt><dd>{plan.slot_minutes} minutes</dd></div>
          <div><dt>Slots</dt><dd>{slotCount(plan)}</dd></div>
          <div><dt>Shift requirement</dt><dd>{plan.min_per_person ? `${plan.min_per_person} each` : 'None'}</dd></div>
          <div><dt>Signed up</dt><dd>{signups}</dd></div>
        </dl>
      </section>
    );
  }
  return (
    <section className={styles.card}>
      <h3 className={styles.h}>{plan ? `Edit the grid for ${event.title}` : `Make the grid for ${event.title}`}</h3>
      {plan && signups > 0 && <Notice tone="warning" compact>{signups} signup{signups === 1 ? ' is' : 's are'} on this grid. Changing the times or slot length can move or drop them, so you will be asked to confirm.</Notice>}
      <EditingNow room={editing ? `shifts-grid:${event.id}` : null} what="this event’s grid" />
      <div className={styles.formRow}>
        <Field label="Starts"><DateTimeInput value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
        <Field label="Ends"><DateTimeInput value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
        <Field label="Slot length"><Select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}>{SLOT_CHOICES.map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select></Field>
        <Field label="Shift requirement" hint="The least number of shifts every officer, lead and exec takes. Inactive or exempted people have none but can still sign up. Empty for no requirement."><Input type="number" min={1} max={48} value={minPer} placeholder="No requirement" onChange={(e) => setMinPer(e.target.value)} /></Field>
      </div>
      {!plan && <div className={styles.actions}><Button onClick={save} loading={busy}>Make the grid</Button></div>}
      {plan && <SaveBar dirty={dirty} saving={busy} onSave={save} onDiscard={discard} message="You have unsaved grid changes" />}
      {plan && !dirty && <div className={styles.actions}><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Done</Button></div>}
    </section>
  );
}

// A real on/off switch (not a tick box), with a line saying what the current state means.
function Toggle({ on, onChange, label, onText, offText, busy = false }: { on: boolean; onChange: (v: boolean) => void; label: string; onText: string; offText: string; busy?: boolean }) {
  return (
    <div className={styles.toggleRow}>
      <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy} className={`${styles.switch} ${on ? styles.switchOn : ''}`} onClick={() => onChange(!on)}><span className={styles.knob} /></button>
      <span className={styles.toggleText}><strong>{label}: {on ? 'On' : 'Off'}</strong><small>{on ? onText : offText}</small></span>
    </div>
  );
}

// Stations and how many people each time slot needs, in one sheet: a row per station, its usual number, then one cell per time slot
// (blank = the usual number). The last row adds a station.
function StationSheet({ event, grid, stations, setStations, onChanged, setError }: {
  event: ShiftEvent; grid: ShiftGrid | null; stations: ShiftStation[]; setStations: (s: ShiftStation[]) => void; onChanged: () => Promise<void>; setError: (e: string) => void;
}) {
  const plan = grid?.plan ?? null;
  const slots = plan ? slotCount(plan) : 0;
  const [newName, setNewName] = useState('');
  const [newNeeded, setNewNeeded] = useState('1');
  const [newArea, setNewArea] = useState('');
  async function addStation() {
    if (!newName.trim()) return;
    const r = await api<{ station: ShiftStation }>('/api/shifts/stations', 'POST', { name: newName, default_needed: Number(newNeeded) || 0, area: newArea });
    if (!r.ok) { setError(r.json.error || 'Couldn’t add that.'); return; }
    setStations([...stations, r.json.station]); setNewName(''); setNewNeeded('1'); setNewArea(''); await onChanged();
  }
  // Station and cell edits stay on screen until Save changes: nothing is sent on blur, and Discard puts back what was saved.
  const [stEdits, setStEdits] = useState<Record<string, Partial<Record<'name' | 'default_needed' | 'category' | 'team_label' | 'area', string>>>>({});
  const [cellEdits, setCellEdits] = useState<Record<string, string>>({});
  const [savingSheet, setSavingSheet] = useState(false);
  const stBase = (st: ShiftStation, f: 'name' | 'default_needed' | 'category' | 'team_label' | 'area') => (f === 'name' ? st.name : f === 'default_needed' ? String(st.default_needed) : f === 'category' ? st.category : f === 'area' ? st.area ?? '' : st.team_label ?? '');
  const stVal = (st: ShiftStation, f: 'name' | 'default_needed' | 'category' | 'team_label' | 'area') => stEdits[st.id]?.[f] ?? stBase(st, f);
  const setSt = (st: ShiftStation, f: 'name' | 'default_needed' | 'category' | 'team_label' | 'area', v: string) => setStEdits((prev) => ({ ...prev, [st.id]: { ...prev[st.id], [f]: v } }));
  const stationPatches = stations.flatMap((st) => {
    const e = stEdits[st.id]; if (!e) return [];
    const patch: Partial<Pick<ShiftStation, 'name' | 'default_needed' | 'category' | 'team_label' | 'area'>> = {};
    if (e.name !== undefined && e.name.trim() !== st.name) patch.name = e.name.trim();
    if (e.default_needed !== undefined && e.default_needed.trim() !== String(st.default_needed)) patch.default_needed = Number(e.default_needed);
    if (e.category !== undefined && e.category !== st.category) patch.category = e.category as ShiftStation['category'];
    if (e.team_label !== undefined && e.team_label.trim() !== (st.team_label ?? '')) patch.team_label = e.team_label.trim() || null;
    if (e.area !== undefined && e.area.trim() !== (st.area ?? '')) patch.area = e.area.trim() || null;
    return Object.keys(patch).length ? [{ st, patch }] : [];
  });
  const cellChanges = Object.entries(cellEdits).flatMap(([key, raw]) => {
    const o = grid?.overrides[key];
    return raw.trim() === (o === undefined ? '' : String(o)) ? [] : [{ key, raw }];
  });
  // Dragging a station column only changes this list; it is saved with everything else by Save changes.
  const [orderEdit, setOrderEdit] = useState<string[] | null>(null);
  const byId = new Map(stations.map((x) => [x.id, x]));
  const ordered = orderEdit ? orderEdit.map((id) => byId.get(id)).filter((x): x is ShiftStation => !!x).concat(stations.filter((x) => !orderEdit.includes(x.id))) : stations;
  const orderChanged = !!orderEdit && ordered.map((x) => x.id).join() !== stations.map((x) => x.id).join();
  function reorderWithin(group: ShiftStation[], nextGroup: ShiftStation[]) {
    const inGroup = new Set(group.map((x) => x.id));
    let k = 0;
    setOrderEdit(ordered.map((x) => (inGroup.has(x.id) ? nextGroup[k++].id : x.id)));
  }
  const sheetDirty = stationPatches.length + cellChanges.length > 0 || orderChanged;
  useUnsavedChanges(sheetDirty ? { stEdits, cellEdits, orderEdit } : 'CLEAN');
  async function saveSheet() {
    for (const { st, patch } of stationPatches) {
      if ((patch.name !== undefined && !patch.name) || (patch.default_needed !== undefined && (!Number.isInteger(patch.default_needed) || patch.default_needed < 0 || patch.default_needed > 50))) { setError(`Check “${st.name}”: it needs a name and a usual number from 0 to 50.`); return; }
    }
    for (const { raw } of cellChanges) {
      const n = Number(raw);
      if (raw.trim() !== '' && (!Number.isInteger(n) || n < 0 || n > 50)) { setError('Choose a number from 0 to 50.'); return; }
    }
    setSavingSheet(true); setError('');
    let next = stations;
    for (const { st, patch } of stationPatches) {
      const r = await api<{ station: ShiftStation }>('/api/shifts/stations', 'PATCH', { id: st.id, ...patch });
      if (!r.ok) { setError(r.json.error || 'Couldn’t save that.'); setStations(next); setSavingSheet(false); return; }
      next = next.map((x) => (x.id === st.id ? r.json.station : x));
    }
    if (orderChanged) {
      const ids = ordered.map((x) => x.id);
      const r = await api('/api/shifts/stations/order', 'PUT', { ids });
      if (!r.ok) { setError(r.json.error || 'Couldn’t save the order.'); setStations(next); setSavingSheet(false); return; }
      next = ids.map((id, i) => ({ ...next.find((x) => x.id === id)!, sort_order: i }));
    }
    setStations(next);
    for (const { key, raw } of cellChanges) {
      const [stationId, slot] = key.split('|');
      const st = next.find((x) => x.id === stationId); if (!st) continue;
      const v = raw.trim() === '' ? null : Number(raw);
      const r = await api(`/api/shifts/${event.id}/override`, 'POST', { station_id: stationId, slot_index: Number(slot), needed: v === st.default_needed ? null : v });
      if (!r.ok) { setError(r.json.error || 'Couldn’t save that.'); setSavingSheet(false); await onChanged(); return; }
    }
    setStEdits({}); setCellEdits({}); setOrderEdit(null);
    await onChanged(); setSavingSheet(false);
  }
  async function removeStation(st: ShiftStation) {
    if (!(await confirmHold({ title: `Remove “${st.name}”?`, message: 'It disappears from every event, with its signups.', confirmLabel: 'Hold to remove' }))) return;
    await api('/api/shifts/stations', 'DELETE', { id: st.id });
    setStations(stations.filter((x) => x.id !== st.id)); await onChanged();
  }
  async function saveCell(st: ShiftStation, slot: number, raw: string) {
    const current = grid ? neededFor(grid, st.id, slot) : st.default_needed;
    const next = raw.trim() === '' ? null : Number(raw);
    if (next !== null && (!Number.isInteger(next) || next < 0 || next > 50)) { setError('Choose a number from 0 to 50.'); return; }
    if ((next ?? st.default_needed) === current) return;
    const r = await api(`/api/shifts/${event.id}/override`, 'POST', { station_id: st.id, slot_index: slot, needed: next === st.default_needed ? null : next });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.');
    await onChanged();
  }

  const areas = [...new Set(stations.map((x) => x.area).filter((x): x is string => !!x))];
  return (
    <section className={styles.card}>
      <h3 className={styles.h}>Stations and people needed</h3>
      <EditingNow room={sheetDirty ? 'shifts-stations' : null} what="the stations" />
      <p className={styles.muted}>Same layout as Sign up. Each station column has its name and usual number of people; the cells below change the number for just that time slot (blank = the usual number). Drag the grip on a station to reorder. Give stations an area (East Ballroom, Theater…) to split them into separate tables. Mark a station “Specific team” to colour it violet and warn others who sign up. What each station does is written in the Guides tab.</p>
      <datalist id="shift-areas">{areas.map((x) => <option key={x} value={x} />)}</datalist>
      <div className={styles.areas}>
        {groupByArea(ordered).map((group) => (
          <AreaSheet key={group.key} group={group} slots={slots} plan={plan} grid={grid} stVal={stVal} stEdits={stEdits} setSt={setSt} cellEdits={cellEdits} setCellEdits={setCellEdits} removeStation={removeStation} onReorder={(next) => reorderWithin(group.stations, next)} />
        ))}
      </div>
      <div className={styles.addStation}>
        <strong>Add a station</strong>
        <div className={styles.formRow}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Station name" maxLength={60} aria-label="New station name" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addStation(); } }} />
          <Input list="shift-areas" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Area (optional)" maxLength={40} aria-label="Area of the new station" />
          <Input type="number" min={0} max={50} value={newNeeded} onChange={(e) => setNewNeeded(e.target.value)} aria-label="Usual number of people for the new station" />
        </div>
        <div className={styles.actions}><Button size="sm" onClick={addStation} disabled={!newName.trim()}><Plus size={14} aria-hidden="true" /> Add station</Button></div>
      </div>
      <SaveBar dirty={sheetDirty} saving={savingSheet} onSave={() => void saveSheet()} onDiscard={() => { setStEdits({}); setCellEdits({}); setOrderEdit(null); }} message="You have unsaved station changes" />
    </section>
  );
}

// One area's table of the setup sheet: its stations side by side (drag the grip to reorder), a row per time slot below.
function AreaSheet({ group, slots, plan, grid, stVal, stEdits, setSt, cellEdits, setCellEdits, removeStation, onReorder }: {
  group: { key: string; label: string; stations: ShiftStation[] }; slots: number; plan: ShiftGrid['plan']; grid: ShiftGrid | null;
  stVal: (st: ShiftStation, f: 'name' | 'default_needed' | 'category' | 'team_label' | 'area') => string;
  stEdits: Record<string, Partial<Record<'name' | 'default_needed' | 'category' | 'team_label' | 'area', string>>>;
  setSt: (st: ShiftStation, f: 'name' | 'default_needed' | 'category' | 'team_label' | 'area', v: string) => void;
  cellEdits: Record<string, string>; setCellEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  removeStation: (st: ShiftStation) => void; onReorder: (next: ShiftStation[]) => void;
}) {
  const { view, dragIndex, dragHandleProps, dropTargetProps } = useDragReorder(group.stations, onReorder, group.key || 'none');
  const changed = (st: ShiftStation, f: 'name' | 'default_needed' | 'category' | 'team_label' | 'area') => (stEdits[st.id]?.[f] !== undefined ? styles.sheetChanged : '');
  return (
    <section className={styles.area} aria-label={group.label || 'Stations'}>
      {group.label && <h3 className={styles.areaHead}>{group.label}</h3>}
      <div className={styles.gridWrap}>
        <table className={`${styles.grid} ${styles.sheet}`} style={{ minWidth: `${130 + view.length * 200}px` }}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>Time</th>
              {view.map((st, idx) => (
                <th key={st.id} scope="col" className={`${styles.slotHead} ${styles.stationHead} ${dragIndex === idx ? styles.dragging : ''}`} {...dropTargetProps(idx)}>
                  <div className={styles.editHead}>
                    <div className={styles.headTop}>
                      <span className={styles.grip} {...dragHandleProps(idx)} aria-label={`Move ${st.name}. Drag, or press the up and down arrow keys`}><GripVertical size={14} aria-hidden="true" /></span>
                      <input className={`${styles.sheetInput} ${changed(st, 'name')}`} value={stVal(st, 'name')} aria-label={`Name of ${st.name}`} maxLength={60} onChange={(e) => setSt(st, 'name', e.target.value)} />
                    </div>
                    <label className={styles.usually}>Usually
                      <input className={`${styles.sheetInput} ${styles.sheetNum} ${changed(st, 'default_needed')}`} type="number" min={0} max={50} value={stVal(st, 'default_needed')} aria-label={`Usual number of people at ${st.name}`} onChange={(e) => setSt(st, 'default_needed', e.target.value)} />
                    </label>
                    <input list="shift-areas" className={`${styles.sheetInput} ${changed(st, 'area')}`} value={stVal(st, 'area')} placeholder="Area (optional)" aria-label={`Area of ${st.name}`} maxLength={40} onChange={(e) => setSt(st, 'area', e.target.value)} />
                    <Select value={stVal(st, 'category')} onChange={(e) => setSt(st, 'category', e.target.value)} aria-label={`Who ${st.name} is for`}>
                      <option value="general">Anyone</option><option value="team">Specific team</option>
                    </Select>
                    {stVal(st, 'category') === 'team' && <input className={`${styles.sheetInput} ${changed(st, 'team_label')}`} value={stVal(st, 'team_label')} placeholder="Team name, e.g. LE" aria-label={`Team for ${st.name}`} maxLength={40} onChange={(e) => setSt(st, 'team_label', e.target.value)} />}
                    <button type="button" className={styles.removeStation} onClick={() => removeStation(st)} aria-label={`Remove ${st.name}`}><Trash2 size={13} aria-hidden="true" /> Remove</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: slots }, (_, i) => {
              const r = slotRange(plan!, i);
              return (
                <tr key={i}>
                  <th scope="row" className={styles.stationName}>{time(r.start)}<small className={styles.rowSub}>to {time(r.end)}</small></th>
                  {view.map((st) => {
                    const o = grid?.overrides[cellKey(st.id, i)];
                    return (
                      <td key={st.id} className={styles.sheetCell}>
                        <input className={`${styles.sheetInput} ${styles.sheetNum} ${o !== undefined || cellEdits[cellKey(st.id, i)] !== undefined ? styles.sheetChanged : ''}`} type="number" min={0} max={50} value={cellEdits[cellKey(st.id, i)] ?? (o === undefined ? '' : String(o))}
                          placeholder={stVal(st, 'default_needed')} aria-label={`${st.name} at ${time(r.start)}`} onChange={(e) => setCellEdits((prev) => ({ ...prev, [cellKey(st.id, i)]: e.target.value }))} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Exec: officers, leads or exec who skip the requirement for this event because they have a dedicated job. They can still sign up.
function ExemptPanel({ event, grid, onChanged, setError }: { event: ShiftEvent; grid: ShiftGrid; onChanged: () => Promise<void>; setError: (e: string) => void }) {
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const taken = new Set(grid.exemptions.map((e) => e.user_id));
  async function add() {
    if (!who) return;
    setBusy(true); setError('');
    const r = await api(`/api/shifts/${event.id}/exempt`, 'POST', { user_id: who, note });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.'); else { setWho(''); setNote(''); }
    await onChanged(); setBusy(false);
  }
  async function remove(id: string) {
    await api(`/api/shifts/${event.id}/exempt`, 'DELETE', { id });
    await onChanged();
  }
  return (
    <section className={styles.card}>
      <h3 className={styles.h}>Exempt from the requirement</h3>
      <p className={styles.muted}>Officers, leads and exec can be exempt for this event even when they are active, for example when they run something dedicated. They have no requirement but can still sign up.</p>
      <div className={styles.formRow}>
        <Field label="Who"><Select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Pick someone…</option>{grid.roster.filter((o) => !taken.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
        <Field label="Reason (optional)"><Input value={note} maxLength={160} onChange={(e) => setNote(e.target.value)} placeholder="Runs the stream" /></Field>
      </div>
      <div className={styles.actions}><Button size="sm" onClick={add} loading={busy} disabled={!who}><Plus size={14} aria-hidden="true" /> Exempt</Button></div>
      {grid.exemptions.length > 0 && (
        <ul className={styles.owe}>
          {grid.exemptions.map((e) => <li key={e.id}><strong>{e.name}</strong><span className={styles.muted}>{e.note ?? 'Exempt for this event'}</span><Button size="sm" variant="ghost" onClick={() => remove(e.id)} aria-label={`Remove ${e.name}’s exemption`}><Trash2 size={14} aria-hidden="true" /></Button></li>)}
        </ul>
      )}
    </section>
  );
}

// Exec: times an officer is away during the event. They cannot take shifts that overlap and need fewer overall.
function AwayPanel({ event, grid, onChanged, setError }: { event: ShiftEvent; grid: ShiftGrid; onChanged: () => Promise<void>; setError: (e: string) => void }) {
  const plan = grid.plan!;
  const [who, setWho] = useState('');
  const [from, setFrom] = useState(toLocalInput(plan.starts_at));
  const [to, setTo] = useState(toLocalInput(plan.ends_at));
  const [needs, setNeeds] = useState('0');
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!who) return;
    setBusy(true); setError('');
    const r = await api(`/api/shifts/${event.id}/absent`, 'POST', { user_id: who, starts_at: new Date(from).toISOString(), ends_at: new Date(to).toISOString(), needs: Number(needs) || 0 });
    if (!r.ok) setError(r.json.error || 'Couldn’t save that.'); else setWho('');
    await onChanged(); setBusy(false);
  }
  async function remove(id: string) {
    await api(`/api/shifts/${event.id}/absent`, 'DELETE', { id });
    await onChanged();
  }
  const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <section className={styles.card}>
      <h3 className={styles.h}>Away for part of the event</h3>
      <p className={styles.muted}>Someone who is away, for a stretch or the whole event, can’t take shifts in that time. Set how many shifts they still need (0 if they are away all event); everyone else keeps the usual {plan.min_per_person ?? 'number'}.</p>
      <div className={styles.formRow}>
        <Field label="Who"><Select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Pick an officer…</option>{grid.officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
        <Field label="Away from"><DateTimeInput value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Until"><DateTimeInput value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Shifts they still need"><Input type="number" min={0} max={48} value={needs} onChange={(e) => setNeeds(e.target.value)} /></Field>
      </div>
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" onClick={() => { setFrom(toLocalInput(plan.starts_at)); setTo(toLocalInput(plan.ends_at)); }}>Whole event</Button><Button size="sm" onClick={add} loading={busy} disabled={!who}><Plus size={14} aria-hidden="true" /> Mark away</Button></div>
      {grid.absences.length > 0 && (
        <ul className={styles.owe}>
          {grid.absences.map((a) => <li key={a.id}><strong>{a.name}</strong><span className={styles.muted}>{when(a.starts_at)} to {when(a.ends_at)} · needs {a.needs}</span><Button size="sm" variant="ghost" onClick={() => remove(a.id)} aria-label={`Remove ${a.name}’s time away`}><Trash2 size={14} aria-hidden="true" /></Button></li>)}
        </ul>
      )}
    </section>
  );
}
