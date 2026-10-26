'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Settings2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { RowMenu } from './RowMenu';
import { ANY_SIZE, suggestPrizes, stepCeiling, type PrizeStepDef } from '@/lib/logistics/prizes';
import { GROUPS, STATUS_LABEL, STATUS_ORDER, eventHolds, groupBy, isGroupBy, money, prizingFixes, stationNeed, statusOf, valueOf, type Fix, type GroupBy } from '@/lib/logistics/prizing';
import { AddStationDialog, HistoryDialog, PrizeDialog, PrizingSettings } from './PrizingDialogs';
import { FixStrip, PrizeRowView, StationBlock, type PrizingCtx, type Row } from './PrizingParts';
import { StationDialog } from './PlanDialogs';
import { usePlan, usePlanList, type PlanSummary, type Station } from './usePlans';
import { useLiveTeam } from './useLiveTeam';
import { useCloseEvent } from './CloseEvent';
import { autoPlan, eventLabel } from './eventPick';
import type { LiveEnvelope } from '@/lib/logistics/live';
import { usePrizes, type PrizeRow } from './usePrizes';
import type { Catalog, LogisticsApi } from './useLogistics';
import type { Route } from './logisticsRoute';
import styles from './logistics.module.css';
import pz from './prizing.module.css';

const VIEW_KEY = 'tg-prizing-view';
interface View { group: GroupBy; steps: string[]; onlyHere: boolean }
const DEFAULT_VIEW: View = { group: 'station', steps: ['sorted'], onlyHere: false };
const readView = (): View => {
  try {
    const j = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
    if (j) return { group: isGroupBy(j.group) ? j.group : DEFAULT_VIEW.group, steps: Array.isArray(j.steps) ? j.steps.map(String) : DEFAULT_VIEW.steps, onlyHere: !!j.onlyHere };
  } catch { /* nothing remembered */ }
  return DEFAULT_VIEW;
};

// Prizing: every prize and the event it is going to on one page. The table is the stock (change the number on hand right in it) and, with an event picked, what each station of that event gets (change those
// numbers too: moving 5 from one station to another is lowering one number and raising the other). The "Fix these" strip says what is wrong, "Group by" shows it by station, sponsor, size, type or status, and the
// event-day counters (Sorted by default) are under each station. Each prize has a history of what happened to its stock.
export default function PrizingPage({ api, data, slug, go }: { api: LogisticsApi; data: Catalog; slug: string | null; go: (r: Route) => void }) {
  const list = usePlanList();
  const prizes = usePrizes();
  const chosen: PlanSummary | null | undefined = useMemo(() => {
    if (!list.plans) return undefined;
    if (slug === 'stock') return null;
    return list.plans.find((p) => p.slug === slug) ?? autoPlan(list.plans, list.today);
  }, [list.plans, list.today, slug]);
  const plan = usePlan(chosen?.id ?? '', true);
  const d = plan.detail;
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  useEffect(() => { setView(readView()); }, []);
  const change = (patch: Partial<View>) => setView((v) => { const next = { ...v, ...patch }; try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)); } catch { /* not remembered */ } return next; });
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState('');
  const [dialog, setDialog] = useState<null | { kind: 'prize'; prize: PrizeRow | null } | { kind: 'history'; prize: PrizeRow } | { kind: 'settings' } | { kind: 'station'; station: Station | null } | { kind: 'addStation' }>(null);
  const [filling, setFilling] = useState('');
  const [shortOf, setShortOf] = useState<Record<string, string>>({});
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<{ id: number; by: string; text: string; at: number }[]>([]);
  const [feedOpen, setFeedOpen] = useState(false);

  const hasEvent = !!chosen && !!d;
  const eventClosed = d?.plan.status === 'closed';
  const manage = data.canManage && hasEvent && !eventClosed;
  const group: GroupBy = view.group === 'station' && !hasEvent ? 'sponsor' : view.group;
  const sizeOrder = useMemo(() => data.lists.prize_size.map((o) => o.value), [data.lists.prize_size]);
  const sponsorName = useMemo(() => new Map(data.sponsors.map((s) => [s.id, s.name])), [data.sponsors]);
  const steps: PrizeStepDef[] = d?.prizes.steps ?? [];
  const shownSteps = useMemo(() => { const names = new Set(view.steps.map((s) => s.toLowerCase())); const shown = steps.filter((s) => names.has(s.name.toLowerCase())); return shown.length ? shown : steps.filter((s) => s.name.toLowerCase() === 'sorted').slice(0, 1); }, [steps, view.steps]);
  const stations = useMemo(() => d?.stations ?? [], [d?.stations]);
  const lines = useMemo(() => d?.prizes.lines ?? [], [d?.prizes.lines]);
  const countMap = useMemo(() => new Map((d?.prizes.done ?? []).map((x) => [`${x.line_id}:${x.step_id}`, x.done])), [d?.prizes.done]);
  const giveIds = useMemo(() => steps.filter((s) => s.gives).map((s) => s.id), [steps]);
  const count = useCallback((lineId: string, stepId: string) => countMap.get(`${lineId}:${stepId}`) ?? 0, [countMap]);
  const givenOf = useCallback((lineId: string) => giveIds.reduce((n, id) => n + (countMap.get(`${lineId}:${id}`) ?? 0), 0), [giveIds, countMap]);
  const lockedIds = useMemo(() => new Set(d?.lockedRequests ?? []), [d?.lockedRequests]);
  const isLocked = useCallback((s: Station) => !!s.prize_request_id && lockedIds.has(s.prize_request_id), [lockedIds]);

  // ---- rows ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const prizeById = useMemo(() => new Map((prizes.rows ?? []).map((p) => [p.id, p])), [prizes.rows]);
  const holds = useMemo(() => eventHolds(lines, (l) => Math.min(givenOf(l.id), l.quantity)), [lines, givenOf]);
  const rows: Row[] = useMemo(() => (prizes.rows ?? []).map((p) => {
    const h = holds.get(p.id);
    return { p, sponsor: p.sponsor_id ? sponsorName.get(p.sponsor_id) ?? null : null, here: h?.total ?? 0, remaining: h?.remaining ?? 0, elsewhere: Math.max(0, p.allocated - (eventClosed ? 0 : h?.remaining ?? 0)), lines: (h?.lines ?? []).map((l) => ({ id: l.id, station_id: l.station_id, quantity: l.quantity })) };
  }), [prizes.rows, holds, sponsorName, eventClosed]);
  const matches = useCallback((p: PrizeRow, sponsor: string | null) => { const t = q.trim().toLowerCase(); return !t || `${p.name} ${sponsor ?? ''} ${p.type ?? ''} ${p.size ?? ''} ${p.bin ?? ''} ${p.source ?? ''}`.toLowerCase().includes(t); }, [q]);

  // ---- stations -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const stationData = useMemo(() => stations.map((s) => {
    const ls = lines.filter((l) => l.station_id === s.id).map((l) => ({ id: l.id, quantity: l.quantity, p: prizeById.get(l.prize_id) ?? ({ ...l.prize, bin: null, source: null, expires_on: null, notes: null, quantity_is_estimate: false, sponsor_id: null, allocated: 0 } as unknown as PrizeRow), sponsor: l.prize.sponsor }));
    const n = stationNeed(s, ls.map((l) => ({ quantity: l.quantity, size: l.p.size })));
    return { s, ls, n };
  }), [stations, lines, prizeById]);
  const shownStations = stationData.filter((x) => !x.s.prize_only || true).filter((x) => x.ls.length > 0 || !!x.s.prize_request_id || x.s.prize_only);
  const addableStations = stations.filter((s) => !shownStations.some((x) => x.s.id === s.id));
  const fixes: Fix[] = useMemo(() => !hasEvent || eventClosed ? [] : prizingFixes({
    prizes: rows.map((r) => ({ ...r.p, assignedHere: r.here })), sizeOrder,
    stations: shownStations.map((x) => ({ ...x.s, lines: x.ls.length, short: x.n.need })),
  }), [hasEvent, eventClosed, rows, shownStations, sizeOrder]);
  const needy = shownStations.filter((x) => Object.keys(x.n.need).length > 0 && !isLocked(x.s));

  // ---- changes ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const summaryOf = (p: PrizeRow) => ({ id: p.id, name: p.name, sponsor: p.sponsor_id ? sponsorName.get(p.sponsor_id) ?? null : null, size: p.size, type: p.type, price: p.price, quantity: p.quantity, quantity_is_estimate: p.quantity_is_estimate, in_hand: p.in_hand, left: p.left });
  const setLine = useCallback(async (stationId: string, p: PrizeRow, n: number) => {
    const r = await plan.setPrizeLine(stationId, summaryOf(p), Math.max(0, Math.round(n)));
    if (r.ok && r.delta) prizes.bump(p.id, r.delta);
  }, [plan, prizes, sponsorName]);   // eslint-disable-line react-hooks/exhaustive-deps
  const setCount = useCallback((lineId: string, stepId: string, n: number) => { void plan.setPrizeCount(lineId, stepId, n); }, [plan]);
  const addCount = useCallback((lineId: string, stepId: string, d: number) => { void plan.addPrizeCount(lineId, stepId, d); }, [plan]);
  const setStock = useCallback((p: PrizeRow, n: number) => { void prizes.save(p.id, { quantity: n, expected_quantity: p.quantity }); }, [prizes]);
  async function fillOne(sid: string, used: Map<string, number> = new Map()) {
    const x = stationData.find((y) => y.s.id === sid);
    if (!x) return;
    setFilling(sid);
    const { picks, short } = suggestPrizes((prizes.rows ?? []).filter((p) => p.in_hand).map((p) => ({ id: p.id, size: p.size, left: p.left - (used.get(p.id) ?? 0), sponsor: !!p.sponsor_id })), x.n.need);
    for (const [id, n] of picks) used.set(id, (used.get(id) ?? 0) + n);
    for (const [id, n] of picks) { const p = prizeById.get(id); if (p) await setLine(sid, p, (x.ls.find((l) => l.p.id === id)?.quantity ?? 0) + n); }
    setShortOf((c) => ({ ...c, [sid]: Object.keys(short).length ? `Not enough in stock for ${Object.entries(short).map(([z, n]) => `${n} ${z === ANY_SIZE ? 'of any size' : z}`).join(', ')}` : '' }));
    setFilling('');
  }
  async function fillAll() { const used = new Map<string, number>(); for (const x of needy) await fillOne(x.s.id, used); }
  async function markAll(stationId: string, step: PrizeStepDef) {
    const x = stationData.find((y) => y.s.id === stationId);
    if (!x) return;
    for (const l of x.ls) { const c = stepCeiling(step, l, givenOf(l.id)); if (c > 0 && count(l.id, step.id) < c) await plan.setPrizeCount(l.id, step.id, c); }
  }
  async function removeStation(s: Station) {
    if (!(await confirmHold({ title: `Remove ${s.name}?`, message: 'Its prizes are taken off it and counted back as free. If it also has devices, it stays on the Devices page.', confirmLabel: 'Hold to remove' }))) return;
    await plan.act(`/stations/${s.id}`, 'DELETE');
    void prizes.reload();
  }
  const closer = useCloseEvent(list, () => { void plan.reload(); void prizes.reload(); });
  const focus = useCallback((f: Fix['focus']) => {
    const id = f.kind === 'prize' ? `prize-${f.id}` : `station-${f.id}`;
    if (f.kind === 'prize') change({ group: group === 'station' ? 'status' : group });
    setFlash(f.id);
    window.setTimeout(() => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    window.setTimeout(() => setFlash(''), 2600);
  }, [group]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ---- other people's changes, as they happen ------------------------------------------------------------------------------------------------------------------------------------
  const latest = useRef({ prizeById, stations, steps, sponsorName });
  latest.current = { prizeById, stations, steps, sponsorName };
  const reloadTimer = useRef<{ plan?: ReturnType<typeof setTimeout>; prizes?: ReturnType<typeof setTimeout> }>({});
  const flashFor = useCallback((keys: string[]) => {
    setFlashKeys((prev) => new Set([...prev, ...keys]));
    window.setTimeout(() => setFlashKeys((prev) => { const n = new Set(prev); keys.forEach((k) => n.delete(k)); return n; }), 2800);
  }, []);
  const onLive = useCallback((m: LiveEnvelope) => {
    const L = latest.current, by = m.by ?? 'Someone';
    const note = (text: string) => setFeed((f) => [{ id: m.at + Math.random(), by, text, at: m.at }, ...f].slice(0, 20));
    if (m.k === 'line') {
      const p = L.prizeById.get(m.prize);
      const ok = plan.applyLine(m, p ? { id: p.id, name: p.name, sponsor: p.sponsor_id ? L.sponsorName.get(p.sponsor_id) ?? null : null, size: p.size, type: p.type, in_hand: p.in_hand, price: p.price, quantity: p.quantity, quantity_is_estimate: p.quantity_is_estimate, left: p.left } : null);
      if (!ok) void plan.reload();
      prizes.bump(m.prize, m.qty - m.was);
      flashFor([`line:${m.line}`, `prize:${m.prize}`]);
      const st = L.stations.find((x) => x.id === m.station)?.name ?? 'a station';
      note(m.qty === 0 ? `took ${p?.name ?? 'a prize'} off ${st}` : `${st} · ${p?.name ?? 'a prize'}: ${m.was} → ${m.qty}`);
    } else if (m.k === 'count') {
      plan.applyCount(m.line, m.step, m.done);
      flashFor([`line:${m.line}`]);
      note(`${L.steps.find((x) => x.id === m.step)?.name ?? 'Step'} counted: ${m.done}`);
    } else if (m.k === 'stock') {
      prizes.applyStock(m.prize, m.qty);
      flashFor([`prize:${m.prize}`]);
      note(`${L.prizeById.get(m.prize)?.name ?? 'A prize'} on hand: ${m.was} → ${m.qty}`);
    } else if (m.k === 'prizes') {
      clearTimeout(reloadTimer.current.prizes); reloadTimer.current.prizes = setTimeout(() => void prizes.reload(), 400);
    } else if (m.k === 'plan') {
      clearTimeout(reloadTimer.current.plan); reloadTimer.current.plan = setTimeout(() => void plan.reload(), 400);
    }
  }, [plan, prizes, flashFor]);
  const team = useLiveTeam({ me: data.me, planId: chosen?.id ?? null, stockChannel: prizes.channel, onChange: onLive });
  const heldBy = useCallback((key: string) => team.here.find((p) => p.editing === key)?.name ?? null, [team.here]);

  const ctx: PrizingCtx = { canStock: data.canManage, manage, closed: !!eventClosed, sizeOrder, shownSteps, count, givenOf, setLine, setCount, addCount, editing: team.setEditing, heldBy, flashing: (k) => flashKeys.has(k), setStock, edit: (p) => setDialog({ kind: 'prize', prize: p }), history: (p) => setDialog({ kind: 'history', prize: p }), locked: isLocked };

  // ---- what is shown ------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const visibleRows = rows.filter((r) => matches(r.p, r.sponsor) && (!view.onlyHere || r.here > 0));
  const groups = useMemo(() => {
    if (group === 'none') return [{ key: 'all', label: '', rows: visibleRows }];
    if (group === 'sponsor') return groupBy(visibleRows, (r) => r.sponsor, 'Club (no sponsor)');
    if (group === 'size') return groupBy(visibleRows, (r) => r.p.size, 'No size', sizeOrder);
    if (group === 'type') return groupBy(visibleRows, (r) => r.p.type, 'No type');
    return groupBy(visibleRows, (r) => STATUS_LABEL[statusOf(r.p, r.here)], 'Other', STATUS_ORDER.map((s) => STATUS_LABEL[s]));
  }, [group, visibleRows, sizeOrder]);
  const stockValue = valueOf((prizes.rows ?? []).map((p) => ({ quantity: p.quantity, price: p.price })));
  const hereValue = valueOf(lines.map((l) => ({ quantity: l.quantity, price: l.prize.price })));

  if (!list.plans || !prizes.rows) return <div className={styles.tab}>{list.error || prizes.error ? <Notice tone="error">{list.error || prizes.error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;
  return (
    <div className={`${styles.tab} ${pz.page}`}>
      <div className={pz.top}>
        <div className={pz.pick}>
          <Select value={chosen?.slug ?? 'stock'} onChange={(e) => go({ tab: 'prizing', plan: e.target.value })} aria-label="Event">
            {list.plans.map((p) => <option key={p.id} value={p.slug}>{eventLabel(p)}</option>)}
            <option value="stock">No event (stock only)</option>
          </Select>
        </div>
        <div className={`${pz.pick} ${pz.pickSmall}`}>
          <Select value={group} onChange={(e) => change({ group: e.target.value as GroupBy })} aria-label="Group by">
            {GROUPS.filter((g) => hasEvent || g.id !== 'station').map((g) => <option key={g.id} value={g.id}>Group by: {g.label}</option>)}
          </Select>
        </div>
        <div className={`${styles.search} ${pz.search}`}><Search size={15} aria-hidden="true" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prizes: what’s left of…?" aria-label="Search prizes" /></div>
        <div className={pz.topEnd}>
          <span className={pz.here} aria-label="Who is on this page">
            <i className={`${pz.liveDot} ${team.live ? '' : pz.liveDotOff}`} title={team.live ? 'Changes appear as they happen' : 'Connecting…'} />
            {team.here.slice(0, 6).map((p) => <span key={p.id} className={`${pz.avatar} ${p.editing ? pz.avatarEditing : ''}`} title={`${p.name}${p.editing ? ' is typing in a number box' : ' is here'}`}>{p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>)}
            {team.here.length > 6 && <small>+{team.here.length - 6}</small>}
          </span>
          {data.canManage && <Button className={styles.addBtn} onClick={() => setDialog({ kind: 'prize', prize: null })}><Plus size={15} aria-hidden="true" /> Add<span className={styles.wide}>Prize</span></Button>}
          {data.canManage && <button type="button" className={pz.gear} onClick={() => setDialog({ kind: 'settings' })} aria-label="Prizing settings" title="Sponsors, sizes and steps"><Settings2 size={17} aria-hidden="true" /></button>}
          {data.canManage && hasEvent && <RowMenu label="This event" items={[eventClosed ? { label: 'Reopen This Event', onClick: () => void closer.reopen(chosen!.id) } : { label: 'Close This Event', onClick: () => void closer.close(chosen!) }]} />}
        </div>
      </div>

      <div className={pz.stats}>
        <span>{prizes.rows.length} prizes · {money(stockValue) || '$0'} in stock</span>
        {hasEvent && <span>This event: {lines.reduce((n, l) => n + l.quantity, 0)} assigned · {money(hereValue) || '$0'}</span>}
        {feed.length > 0 && <button type="button" className={pz.feedBtn} onClick={() => setFeedOpen((v) => !v)} aria-expanded={feedOpen}>{feedOpen ? 'Hide' : 'Show'} recent changes ({feed.length})</button>}
        {eventClosed && <span className={pz.closedTag}>Closed: what went out and was not counted back is out of stock</span>}
        {group !== 'station' && hasEvent && <label className={pz.onlyHere}><input type="checkbox" checked={view.onlyHere} onChange={(e) => change({ onlyHere: e.target.checked })} /> Only prizes in this event</label>}
      </div>
      {feedOpen && feed.length > 0 && <ul className={pz.feed} aria-label="Recent changes by others">{feed.map((f) => <li key={f.id}><b>{f.by}</b> {f.text}<small>{new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></li>)}</ul>}
      {hasEvent && group === 'station' && steps.length > 0 && (
        <div className={pz.steps} role="group" aria-label="Event-day counters to show">
          <span className={pz.stepsLabel}>Counters</span>
          {steps.map((s) => { const on = shownSteps.some((x) => x.id === s.id); return <button key={s.id} type="button" className={`${pz.stepChip} ${on ? pz.stepOn : ''}`} aria-pressed={on} onClick={() => change({ steps: on ? shownSteps.filter((x) => x.id !== s.id).map((x) => x.name.toLowerCase()) : [...shownSteps.map((x) => x.name.toLowerCase()), s.name.toLowerCase()] })}>{s.name}</button>; })}
        </div>
      )}
      {prizes.error && <div role="alert" onClick={() => prizes.setError('')}><Notice tone="error">{prizes.error}</Notice></div>}
      {plan.error && <div role="alert" onClick={() => plan.setError('')}><Notice tone="error">{plan.error}</Notice></div>}
      <FixStrip fixes={fixes} onFocus={focus} />
      {hasEvent && manage && needy.length > 1 && <div className={pz.fillAll}><Button size="sm" variant="secondary" loading={!!filling} onClick={() => void fillAll()}>Suggest Prizes For {needy.length} Stations</Button><span className={styles.muted}>Fills what each station asked for, sponsor prizes first.</span></div>}

      {group === 'station' && hasEvent ? (
        <div className={pz.blocks}>
          {shownStations.length === 0 && <div className={styles.empty}><p>No stations have prizes yet. {manage ? 'Add a station, then add prizes to it.' : ''}</p></div>}
          {shownStations.filter((x) => !q.trim() || x.s.name.toLowerCase().includes(q.trim().toLowerCase()) || x.ls.some((l) => matches(l.p, l.sponsor))).map((x) => (
            <div key={x.s.id}>
              <StationBlock station={x.s} lines={x.ls.filter((l) => !q.trim() || matches(l.p, l.sponsor) || x.s.name.toLowerCase().includes(q.trim().toLowerCase()))} ctx={ctx}
                addable={(prizes.rows ?? []).filter((p) => p.left > 0 && !x.ls.some((l) => l.p.id === p.id))} need={x.n.need} asked={x.n.asked}
                onAdd={(p) => void setLine(x.s.id, p, 1)} onFill={Object.keys(x.n.need).length > 0 && manage ? () => void fillOne(x.s.id) : undefined}
                onEdit={() => setDialog({ kind: 'station', station: x.s })} onRemove={() => void removeStation(x.s)} flash={flash === x.s.id}
                summary={(stepId) => { const st = steps.find((s) => s.id === stepId); if (!st) return null; return { total: x.ls.reduce((n, l) => n + stepCeiling(st, l, givenOf(l.id)), 0), done: x.ls.reduce((n, l) => n + Math.min(count(l.id, stepId), stepCeiling(st, l, givenOf(l.id))), 0) }; }}
                onAll={manage || (hasEvent && !eventClosed) ? (stepId) => { const st = steps.find((s) => s.id === stepId); if (st) void markAll(x.s.id, st); } : undefined} />
              {(filling === x.s.id || shortOf[x.s.id]) && <p className={pz.muted}>{filling === x.s.id ? 'Choosing prizes…' : shortOf[x.s.id]}</p>}
            </div>
          ))}
          {manage && <div className={pz.addStation}><Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'addStation' })}><Plus size={14} aria-hidden="true" /> Add Station</Button></div>}
        </div>
      ) : (
        <div className={pz.table}>
          <div className={`${pz.row} ${pz.head}`} aria-hidden="true"><span>Prize</span><span>In stock</span><span>Left</span>{hasEvent && <span>This event</span>}<span /></div>
          {groups.every((g) => g.rows.length === 0) && <div className={styles.empty}><p>{rows.length === 0 ? 'No prizes yet. Add the first one.' : 'Nothing matches.'}</p></div>}
          {groups.filter((g) => g.rows.length > 0).map((g) => (
            <div key={g.key}>
              {group !== 'none' && (
                <div className={pz.groupHead}>
                  <b>{g.label}</b><span>{g.rows.length} {g.rows.length === 1 ? 'prize' : 'prizes'} · {money(valueOf(g.rows.map((r) => ({ quantity: r.p.quantity, price: r.p.price })))) || '$0'} in stock{hasEvent ? ` · ${money(valueOf(g.rows.map((r) => ({ quantity: r.here, price: r.p.price })))) || '$0'} this event` : ''}</span>
                </div>
              )}
              {g.rows.map((r) => <PrizeRowView key={r.p.id} row={r} ctx={ctx} stations={stations} hasEvent={hasEvent} open={!!open[r.p.id]} onToggle={() => setOpen((o) => ({ ...o, [r.p.id]: !o[r.p.id] }))} flash={flash === r.p.id} />)}
            </div>
          ))}
        </div>
      )}

      {dialog?.kind === 'prize' && <PrizeDialog prizes={prizes} api={api} data={data} prize={dialog.prize} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'history' && <HistoryDialog prize={dialog.prize} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'settings' && <PrizingSettings api={api} data={data} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'station' && <StationDialog plan={plan} station={dialog.station} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'addStation' && <AddStationDialog plan={plan} existing={addableStations} onClose={() => setDialog(null)} />}
      {closer.dialog}
    </div>
  );
}
