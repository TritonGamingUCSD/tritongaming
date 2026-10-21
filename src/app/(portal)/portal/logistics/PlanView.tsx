'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import Loading from '@/components/Loading/Loading';
import { confirmHold } from '@/lib/ui/confirmHold';
import { tagKey } from '@/lib/logistics/devices';
import { natural, planProblems, rowKind, stationStatus, stepAppliesTo, type StepDef } from '@/lib/logistics/plans';
import BorrowedDialog from './BorrowedDialog';
import HowItWorks from './HowItWorks';
import { EditPlanDialog, FillDialog, RowDialog, StationDialog } from './PlanDialogs';
import PickDialog from './PickDialog';
import { SheetRows, type SheetCtx } from './PlanSheet';
import SwapDialog from './SwapDialog';
import { planRows, type Row } from './planRows';
import { doneKey, usePlan, type Borrowed, type Slim, type Station, type StepResult } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import styles from './logistics.module.css';

// The plan and the event day are one sheet. A block per team, a line per device (or per set), the step boxes on the line. Before the event it is where devices are chosen and what is
// wrong gets fixed; on the day the same lines are ticked: tap a box (tap a ticked one to undo it), or type a device's ID and the picked step is ticked for it, with where to get it and
// which team it goes to. The step to type for follows the work. "Mark all" ticks the picked step for a team. Anything wrong is marked on its own line.
type Feedback = { tone: 'ok' | 'already' | 'error'; text: string; result?: StepResult; step?: StepDef } | null;
type Target = Pick<Row, 'id' | 'kind' | 'itemKind' | 'tag' | 'type' | 'kit'>;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const whereOf = (d: Slim) => (d.kind === 'club' ? [d.shelf, d.tier].filter(Boolean).join(' · ') || 'No place set' : d.kind === 'slot' ? 'Counted: take from stock' : `${d.kind === 'sponsor' ? 'From' : 'From officer'} ${d.owner ?? 'its owner'}`);
const bodyOf = (r: Pick<Row, 'id' | 'kind'>) => (r.kind === 'club' ? { device_id: r.id } : r.kind === 'slot' ? { slot_id: r.id } : { borrowed_id: r.id });
const range = (a: string, b: string) => {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  return a === b ? f(a) : `${f(a)} to ${f(b)}`;
};

export default function PlanView({ id, data, catalog, onBack }: { id: string; data: Catalog; catalog: LogisticsApi; onBack: () => void }) {
  const plan = usePlan(id, true);
  const { detail, error, setError, act } = plan;
  const [picked, setPicked] = useState('');   // '' = follow the work
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [kit, setKit] = useState<{ row: Target; flags: Record<string, boolean> } | null>(null);
  const [swapping, setSwapping] = useState<{ id: string; tag: string | null; type: string; kind: 'club' | 'sponsor' | 'officer' } | null>(null);
  const [borrowing, setBorrowing] = useState<Borrowed | 'new' | null>(null);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stationDialog, setStationDialog] = useState<{ station: Station | null } | null>(null);
  const [rowDialog, setRowDialog] = useState<Station | null>(null);
  const [filling, setFilling] = useState<{ station: Station | null } | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());   // teams the person opened (finished teams, and every team on a phone, start folded)
  const [overview, setOverview] = useState(false);
  const [showList, setShowList] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const steps = useMemo(() => detail?.steps ?? [], [detail?.steps]);
  const counted = useMemo(() => new Set(data.lists.type.filter((t) => t.counted).map((t) => t.value)), [data.lists.type]);
  const doneSet = useMemo(() => new Set((detail?.done ?? []).map(doneKey)), [detail?.done]);
  const doneAt = useMemo(() => new Map((detail?.done ?? []).map((d) => [doneKey(d), d.done_at])), [detail?.done]);
  const stationOf = useMemo(() => new Map((detail?.stations ?? []).map((s) => [s.id, s])), [detail?.stations]);

  const all = useMemo(() => (detail ? planRows(detail, counted) : []), [detail, counted]);
  const rows: Row[] = useMemo(() => {
    if (!detail) return [];
    const order = new Map(detail.stations.map((s) => [s.id, s.sort]));
    return all.filter((r) => r.role === 'planned').sort((a, b) => ((a.station_id ? order.get(a.station_id) ?? 999 : 1000) - (b.station_id ? order.get(b.station_id) ?? 999 : 1000)) || a.sort - b.sort || natural(a.tag ?? a.type, b.tag ?? b.type));
  }, [detail, all]);
  const backups = useMemo(() => all.filter((r) => r.role === 'backup'), [all]);

  const stepStats = useMemo(() => steps.map((s) => {
    const mine = rows.filter((r) => stepAppliesTo(s, rowKind(r)));
    return { step: s, total: mine.length, done: mine.filter((r) => doneSet.has(`${r.id}:${s.id}`)).length };
  }), [steps, rows, doneSet]);
  const auto = stepStats.find((p) => p.done < p.total)?.step ?? stepStats[stepStats.length - 1]?.step ?? null;
  const step = steps.find((s) => s.id === picked) ?? auto;
  const allDone = stepStats.reduce((n, p) => n + p.done, 0), allTotal = stepStats.reduce((n, p) => n + p.total, 0);
  const problems = useMemo(() => (detail ? planProblems(rows, detail.stations, steps, doneSet, detail.conflicts, () => null) : []), [detail, rows, steps, doneSet]);
  const bad = problems.filter((p) => p.sev === 'bad').length, warn = problems.length - bad;

  const teams = useMemo(() => {
    const out: { key: string; station: Station | null; title: string; rows: Row[] }[] = [];
    for (const s of detail?.stations ?? []) out.push({ key: s.id, station: s, title: s.name, rows: [] });
    for (const r of rows) {
      let g = out.find((x) => x.key === (r.station_id ?? 'none'));
      if (!g) { g = { key: 'none', station: null, title: 'Not On A Team Yet', rows: [] }; out.push(g); }
      g.rows.push(r);
    }
    return out.filter((t) => t.station || t.rows.length);
  }, [detail?.stations, rows]);

  useEffect(() => {
    const m = window.matchMedia('(max-width: 899px)');
    const sync = () => setNarrow(m.matches);
    sync(); m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, []);

  async function run(body: { tag?: string; device_id?: string; borrowed_id?: string; slot_id?: string; kit?: { item: string; missing: boolean }[] }, forStep: StepDef | null = step) {
    if (!forStep) return;
    setBusy(true); setError('');
    const r = await plan.doStep({ ...body, step_id: forStep.id });
    setBusy(false);
    if (!r.ok) { setFeedback({ tone: 'error', text: r.error }); return; }
    const res = r.result;
    const name = res.item.tag ?? res.item.type;
    if (res.already) setFeedback({ tone: 'already', text: `${name} was already marked “${forStep.name}” at ${time(res.done_at)}.`, result: res, step: forStep });
    else setFeedback({ tone: 'ok', text: `${name}: ${forStep.name}`, result: res, step: forStep });
    setText(''); setKit(null);
    input.current?.focus();
  }
  // Check done (a step that reviews the parts) shows the parts first; the others tick straight away.
  function begin(row: Row | null, forStep: StepDef | null = step, tag?: string) {
    if (!forStep) return;
    let target: Target | null = row;
    if (!row && tag) {
      const b = detail?.borrowed.find((x) => tagKey(x.tag) === tagKey(tag));
      const d = data.devices.find((x) => tagKey(x.tag) === tagKey(tag));
      if (b) target = { id: b.id, kind: b.owner_kind, itemKind: b.owner_kind, tag: b.tag, type: b.type, kit: b.kit };
      else if (d) target = { id: d.id, kind: 'club', itemKind: 'club', tag: d.tag, type: d.type, kit: d.kit };
    }
    if (forStep.kit && target && target.kit.length > 0 && !doneSet.has(`${target.id}:${forStep.id}`)) { setKit({ row: target, flags: Object.fromEntries(target.kit.map((k) => [k.item, k.missing])) }); setPicked(forStep.id); return; }
    void run(row ? bodyOf(row) : { tag }, forStep);
  }
  const submit = () => { if (text.trim() && !busy) begin(null, step, text.trim()); };
  async function undo(item: { id: string; kind: Slim['kind'] }, stepIdToUndo: string) {
    if (await plan.undoStep(item, stepIdToUndo)) setFeedback(null);
  }
  async function markAll(list: Row[], forStep: StepDef) {
    const todo = list.filter((r) => stepAppliesTo(forStep, rowKind(r)) && !doneSet.has(`${r.id}:${forStep.id}`));
    if (!todo.length) return;
    setBusy(true); setError('');
    const results = await Promise.all(todo.map((r) => plan.doStep({ ...bodyOf(r), step_id: forStep.id })));
    setBusy(false);
    const failed = results.filter((x) => !x.ok).length;
    setFeedback(failed ? { tone: 'error', text: `${todo.length - failed} of ${todo.length} marked “${forStep.name}”. ${failed} failed.` } : { tone: 'ok', text: `${todo.length} marked “${forStep.name}”` });
  }

  if (!detail) return <div className={styles.tab}><button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Plans</button>{error ? <Notice tone="error">{error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;

  const { plan: p, canManage, stations, borrowed, extras } = detail;
  const closed = p.status === 'closed';
  const manage = canManage && !closed;
  const fb = feedback, res = fb?.result;
  const resStation = res?.station ? stationOf.get(res.station.id) : null;
  const pct = allTotal ? Math.round((allDone / allTotal) * 100) : 0;
  const emptyRows = rows.filter((r) => r.kind === 'slot' && !r.counted);
  const ctx: SheetCtx = {
    api: plan, canManage, closed, busy, stations, steps, activeId: step?.id ?? '', doneSet, doneAt, problems,
    onTick: (row, s) => begin(row, s), onTickAll: (list, s) => void markAll(list, s), onUndo: undo, onSwap: (r) => setSwapping({ id: r.id, tag: r.tag, type: r.type, kind: r.kind === 'slot' ? 'club' : r.kind }),
    onBorrowed: (r) => setBorrowing(borrowed.find((b) => b.id === r.id) ?? null),
  };
  const jump = (sid: string | null) => { if (!sid) return; setOpen((cur) => new Set(cur).add(sid)); setTimeout(() => document.getElementById(`st-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); };

  async function remove() {
    if (!(await confirmHold({ title: `Remove “${p.name}”?`, message: 'The plan, its teams, the devices in it (including any borrowed ones) and every step recorded for it are deleted. The inventory itself is not touched.', confirmLabel: 'Hold to remove' }))) return;
    if (await act('', 'DELETE')) onBack();
  }
  async function removeStation(s: Station) {
    if (!(await confirmHold({ title: `Remove ${s.name}?`, message: 'Its rows are removed with it. The devices themselves stay in the inventory.', confirmLabel: 'Hold to remove' }))) return;
    await act('/stations', 'DELETE', { station_id: s.id });
  }

  return (
    <div className={styles.dayPage}>
      <div className={styles.dayTop}>
        <div className={styles.dayBar}>
          <button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Plans</button>
          <div className={styles.dayHeading}>
            <b className={styles.dayTitle}>{p.name}{closed && <span className={`${styles.badge} ${styles.neutral}`}>Closed</span>}</b>
            <span className={styles.muted}>{range(p.starts_on, p.ends_on)}{p.event_id ? ' · portal event' : ' · Logistics event'}{p.notes ? ` · ${p.notes}` : ''}</span>
          </div>
          <span className={styles.dayTotal} title="Steps done"><span className={styles.bar}><i style={{ width: `${pct}%` }} /></span>{allDone}/{allTotal}</span>
          <button type="button" className={styles.iconBtn} onClick={() => void plan.reload()} aria-label="Refresh"><RefreshCw size={15} aria-hidden="true" /></button>
          {manage && <Button variant="secondary" onClick={() => setPicking(true)}>Add Teams And Devices</Button>}
          {canManage && (
            <details className={styles.menu}>
              <summary aria-label="More actions">More</summary>
              <div className={styles.menuList}>
                {manage && <button type="button" onClick={() => setStationDialog({ station: null })}>Add A Team</button>}
                {manage && <button type="button" onClick={() => setBorrowing('new')}>Add A Borrowed Device</button>}
                <button type="button" onClick={() => setEditing(true)}>Edit Name And Dates</button>
                <button type="button" onClick={() => void act('', 'PATCH', { status: closed ? 'draft' : 'closed' })}>{closed ? 'Reopen Plan' : 'Close Plan'}</button>
                <button type="button" className={styles.menuDanger} onClick={remove}>Remove Plan</button>
              </div>
            </details>
          )}
        </div>
        {closed ? <Notice tone="error">This plan is closed, so nothing more can be recorded.</Notice> : (
          <form className={styles.dayForm} onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <select className={styles.daySelect} value={picked} onChange={(e) => { setPicked(e.target.value); setKit(null); input.current?.focus(); }} aria-label="Step to mark when typing an ID">
              <option value="">Next step: {auto?.name ?? '–'}</option>
              {stepStats.map((s) => <option key={s.step.id} value={s.step.id}>{s.step.name} ({s.done}/{s.total})</option>)}
            </select>
            <input ref={input} className={styles.dayInput} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Type an ID to mark “${step?.name ?? 'the step'}”`} aria-label={`Device ID for ${step?.name ?? 'the step'}`} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" disabled={busy || !step} />
            <Button type="submit" disabled={!text.trim() || busy} loading={busy}>Mark</Button>
          </form>
        )}
      </div>
      {error && <div role="alert" onClick={() => setError('')}><Notice tone="error">{error}</Notice></div>}

      <div className={styles.dayLayout}>
        {(fb || kit) && <div className={styles.dayAside}>
          {fb && (
            <div className={`${styles.result} ${fb.tone === 'ok' ? styles.resultOk : fb.tone === 'already' ? styles.resultWarn : styles.resultBad}`} role="status" aria-live="polite">
              <div className={styles.resultHead}><b>{fb.text}</b></div>
              {res && (
                <>
                  <div className={styles.getIt}>
                    <span className={styles.getItLabel}>{res.item.type}{res.item.name ? ` · ${res.item.name}` : ''}</span>
                    <b className={styles.getItPlace}>{whereOf(res.item)}</b>
                    {res.item.place_note && <span>{res.item.place_note}</span>}
                    {res.station ? <span className={styles.getItStation}>Goes to {res.station.name}{resStation?.room ? ` · ${resStation.room}` : ''}{resStation?.contact ? ` · ${resStation.contact}` : ''}</span> : res.inPlan ? <span className={styles.dim}>No team yet</span> : null}
                    {res.item.games_needed && res.item.games_needed.length > 0 && <span>Needs {res.item.games_needed.join(', ')} installed</span>}
                  </div>
                  {!res.inPlan && <p className={styles.warn}>Not in this plan. It was recorded anyway{canManage ? ', and you can add it to the plan below.' : '. Ask the logistics team to add it to the plan.'}</p>}
                  <div className={styles.resultActions}>
                    {fb.tone !== 'error' && fb.step && <Button size="sm" variant="secondary" onClick={() => void undo(res.item, fb.step!.id)}>Undo</Button>}
                    {res.inPlan && res.role === 'planned' && res.item.kind !== 'slot' && <Button size="sm" variant="secondary" onClick={() => setSwapping({ id: res.item.id, tag: res.item.tag, type: res.item.type, kind: res.item.kind as 'club' | 'sponsor' | 'officer' })}>Swap</Button>}
                    {!res.inPlan && canManage && res.item.kind === 'club' && <><Button size="sm" variant="secondary" onClick={() => void act('/devices', 'POST', { device_ids: [res.item.id] })}>Add To Plan</Button><Button size="sm" variant="secondary" onClick={() => void act('/devices', 'POST', { device_ids: [res.item.id], role: 'backup' })}>Add As Backup</Button></>}
                  </div>
                </>
              )}
            </div>
          )}

          {kit && step && (
            <div className={styles.kitPanel} role="group" aria-label={`Parts of ${kit.row.tag}`}>
              <b>{kit.row.tag} · {kit.row.type}</b>
              <p className={styles.muted}>Check each part is there, then press Mark. Tap a part to flag it missing.</p>
              <ul className={styles.kitList}>
                {kit.row.kit.map((k) => (
                  <li key={k.item} className={`${styles.kitLine} ${kit.flags[k.item] ? styles.kitMissing : ''}`}>
                    <span className={styles.kitName}>{k.item}{k.qty > 1 ? ` ×${k.qty}` : ''}</span>
                    <button type="button" className={`${styles.missBtn} ${kit.flags[k.item] ? styles.missOn : ''}`} aria-pressed={kit.flags[k.item]} onClick={() => setKit({ ...kit, flags: { ...kit.flags, [k.item]: !kit.flags[k.item] } })}>{kit.flags[k.item] ? 'Missing' : 'Present'}</button>
                  </li>
                ))}
              </ul>
              <div className={styles.resultActions}>
                <Button onClick={() => void run({ ...bodyOf(kit.row), kit: kit.row.kit.map((k) => ({ item: k.item, missing: !!kit.flags[k.item] })) })} loading={busy}>Mark {step.name}</Button>
                <Button variant="ghost" onClick={() => { setKit(null); input.current?.focus(); }} disabled={busy}>Cancel</Button>
              </div>
            </div>
          )}
        </div>}

        <div className={styles.dayMain}>
          {rows.length > 0 && (
            <section className={`${styles.statusBar} ${bad ? styles.readyBad : warn ? styles.readyWarn : styles.readyOk}`} aria-label="What needs fixing">
              <div className={styles.readyHead}>
                <b>{bad || warn ? `${problems.length} to fix` : 'Everything is ready'}</b>
                {bad > 0 && <span className={`${styles.badge} ${styles.bad}`}>{bad} wrong</span>}
                {warn > 0 && <span className={`${styles.badge} ${styles.warnBadge}`}>{warn} to check</span>}
                <span className={styles.statusSpacer} />
                {manage && emptyRows.length > 0 && <Button size="sm" variant="secondary" onClick={() => setFilling({ station: null })}>Fill {emptyRows.length} Empty</Button>}
                {problems.length > 0 && <button type="button" className={styles.linkBtn} aria-expanded={showList} onClick={() => setShowList((v) => !v)}>{showList ? 'Hide list' : 'Show list'}</button>}
                <button type="button" className={styles.linkBtn} aria-expanded={overview} onClick={() => setOverview((v) => !v)}>{overview ? 'Hide overview' : 'Overview'}</button>
                <button type="button" className={styles.linkBtn} onClick={() => setOpen(new Set(teams.map((t) => t.key)))}>Open all</button>
                <button type="button" className={styles.linkBtn} onClick={() => setOpen(new Set())}>{narrow ? 'Fold all' : 'Fold finished'}</button>
                <HowItWorks id="plan" title="Help" compact>
                  <ol className={styles.helpSteps}>
                    <li>Each block is a team, each line a device (a bundle shows as one line, “Parts” opens it).</li>
                    <li>Tap a box to tick a step; tap it again to undo. Or type a device’s ID above and press Mark.</li>
                    <li>“Mark all” ticks the picked step for a team. Red and amber lines need a look.</li>
                  </ol>
                </HowItWorks>
              </div>
              {showList && problems.length > 0 && (
                <ul className={styles.problemList}>
                  {problems.map((pr, i) => (
                    <li key={i} className={pr.sev === 'bad' ? styles.problemBad : styles.problemWarn}>
                      <span>{pr.text}</span>
                      {pr.station_id && <button type="button" className={styles.linkBtn} onClick={() => jump(pr.station_id)}>Go to team</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {overview && (
            <div className={styles.overviewWrap}>
              <table className={styles.overview}>
                <thead><tr><th scope="col">Team</th>{steps.map((s) => <th key={s.id} scope="col">{s.name}</th>)}</tr></thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.key}>
                      <th scope="row"><button type="button" className={styles.linkBtn} onClick={() => jump(t.key)}>{t.title}</button></th>
                      {steps.map((s) => {
                        const m = t.rows.filter((r) => stepAppliesTo(s, rowKind(r)));
                        const d = m.filter((r) => doneSet.has(`${r.id}:${s.id}`)).length;
                        return <td key={s.id} className={m.length === 0 ? styles.ovNa : d === m.length ? styles.ovDone : d > 0 ? styles.ovPart : ''}>{m.length === 0 ? '–' : `${d}/${m.length}`}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length === 0 && backups.length === 0 && (
            <>
              <HowItWorks id="plan-empty" startOpen>
                <ol className={styles.helpSteps}>
                  <li><b>Add teams.</b> “Add Teams And Devices” makes them from a bundle (like five PC stations) with a device in every row.</li>
                  <li><b>Check the sheet.</b> Red and amber lines need a look. Give an empty row a device by typing its ID.</li>
                  <li><b>On the day,</b> tick the step boxes here, or type IDs above.</li>
                </ol>
              </HowItWorks>
              <div className={styles.empty}><p>{canManage ? 'No teams yet. Start with “Add Teams And Devices”.' : 'No teams have been added to this plan yet.'}</p></div>
            </>
          )}

          {teams.map((t, ti) => {
            const mineStats = steps.map((s) => {
              const m = t.rows.filter((r) => stepAppliesTo(s, rowKind(r)));
              return { s, total: m.length, done: m.filter((r) => doneSet.has(`${r.id}:${s.id}`)).length };
            });
            const total = mineStats.reduce((n, x) => n + x.total, 0), done = mineStats.reduce((n, x) => n + x.done, 0);
            const complete = total > 0 && done === total;
            const folded = (complete || narrow) && !open.has(t.key);
            const left = step ? mineStats.find((x) => x.s.id === step.id) : null;
            const s = t.station;
            const status = s ? stationStatus(problems, s.id) : 'ok';
            const mine = s ? problems.filter((x) => x.station_id === s.id) : [];
            const emptyHere = t.rows.filter((r) => r.kind === 'slot' && !r.counted).length;
            return (
              <section key={t.key} id={`st-${t.key}`} className={`${styles.dayTeam} ${complete ? styles.dayTeamDone : ''} ${styles[`tint${ti % 3}`]}`} style={{ '--n': steps.length } as React.CSSProperties} aria-label={t.title}>
                <div className={`${styles.dayRow} ${styles.dayRowHead}`}>
                  <div className={styles.teamHeadMain}>
                    <div className={styles.teamLine}>
                      <button type="button" className={styles.foldBtn} aria-expanded={!folded} onClick={() => setOpen((cur) => { const n = new Set(cur); if (n.has(t.key)) n.delete(t.key); else n.add(t.key); return n; })}>
                        <span className={styles.foldMark} aria-hidden="true">{folded ? '+' : '–'}</span>
                        <b>{t.title}</b>
                      </button>
                      {s && <span className={`${styles.statusChip} ${status === 'ok' ? styles.chipOk : status === 'bad' ? styles.chipBad : styles.chipWarn}`}>{status === 'ok' ? 'Ready' : `${mine.length} to fix`}</span>}
                      <span className={complete ? styles.dTeamDone : styles.dTeamNum}>{complete ? 'All done' : `${done}/${total}`}</span>
                    </div>
                    {s && (
                      <div className={styles.teamLine}>
                        <span className={styles.dTeamSub}>{s.contact ?? <span className={styles.warnText}>No contact</span>} · {s.room ?? <span className={styles.warnText}>No room</span>}</span>
                        {manage ? (
                          <label className={styles.confirmBox}><input type="checkbox" checked={s.confirmed} onChange={(e) => void plan.act('/stations', 'PATCH', { station_id: s.id, confirmed: e.target.checked })} /> Confirmed</label>
                        ) : <span className={`${styles.statusChip} ${s.confirmed ? styles.chipOk : styles.chipWarn}`}>{s.confirmed ? 'Confirmed' : 'Not confirmed'}</span>}
                      </div>
                    )}
                    {!folded && (
                      <div className={styles.teamLine}>
                        {!closed && step && !step.kit && left && left.done < left.total && <Button size="sm" variant="secondary" onClick={() => void markAll(t.rows, step)} disabled={busy}>Mark all “{step.name}”</Button>}
                        {manage && s && <Button size="sm" variant="secondary" onClick={() => setRowDialog(s)}>Add Rows</Button>}
                        {manage && s && emptyHere > 0 && <Button size="sm" variant="secondary" onClick={() => setFilling({ station: s })}>Fill {emptyHere} Empty</Button>}
                        {manage && s && <Button size="sm" variant="ghost" onClick={() => setStationDialog({ station: s })}>Edit</Button>}
                        {manage && s && <Button size="sm" variant="ghost" onClick={() => void removeStation(s)}>Remove</Button>}
                      </div>
                    )}
                  </div>
                  <div className={styles.dHeads}>
                    {mineStats.map((x) => (
                      <button key={x.s.id} type="button" className={`${styles.dHead} ${step?.id === x.s.id ? styles.dHeadOn : ''} ${x.total > 0 && x.done === x.total ? styles.dHeadDone : ''}`} onClick={() => { setPicked(x.s.id); setKit(null); input.current?.focus(); }} title={`Type IDs for “${x.s.name}”`}>
                        <span>{x.s.name}</span><small>{x.done}/{x.total}</small>
                      </button>
                    ))}
                  </div>
                </div>
                {!folded && (t.rows.length === 0 ? <p className={styles.teamEmpty}>No rows yet.{manage ? ' Use Add Rows for what this team needs.' : ''}</p> : <SheetRows rows={t.rows} ctx={ctx} />)}
              </section>
            );
          })}

          {backups.length > 0 && (
            <section className={styles.dayTeam} style={{ '--n': steps.length } as React.CSSProperties} aria-label="Backups">
              <div className={`${styles.dayRow} ${styles.dayRowHead}`}><div className={styles.teamHeadMain}><b>Backups <span className={styles.dim}>{backups.length}</span></b></div></div>
              <SheetRows rows={backups} ctx={ctx} backup />
            </section>
          )}

          {extras.length > 0 && (
            <section className={styles.panel} aria-label="Not in plan">
              <h3 className={styles.panelTitle}>Used But Not In The Plan <span className={styles.dim}>{extras.length}</span></h3>
              <p className={styles.muted}>These were ticked on the day but nobody planned them. Add them so the record is complete.</p>
              <ul className={styles.planList}>{extras.map((d) => (
                <li key={d.id} className={styles.planRow}>
                  <div className={styles.planRowMain}><b className={styles.planTag}>{d.tag ?? d.type}</b><span className={styles.planSub}>{d.type}{d.name ? ` · ${d.name}` : ''}</span></div>
                  {manage && <div className={styles.planRowSide}><Button size="sm" variant="secondary" onClick={() => void act('/devices', 'POST', { device_ids: [d.id], role: 'backup' })}>Add As Backup</Button><Button size="sm" variant="secondary" onClick={() => void act('/devices', 'POST', { device_ids: [d.id] })}>Add To Plan</Button></div>}
                </li>
              ))}</ul>
            </section>
          )}
        </div>
      </div>

      {picking && <PickDialog plan={plan} data={data} stations={stations} onClose={() => setPicking(false)} />}
      {swapping && <SwapDialog plan={plan} device={swapping} onClose={() => setSwapping(null)} />}
      {borrowing && <BorrowedDialog plan={plan} catalog={catalog} data={data} stations={stations} borrowed={borrowing === 'new' ? null : borrowing} onClose={() => setBorrowing(null)} />}
      {editing && <EditPlanDialog plan={plan} onClose={() => setEditing(false)} />}
      {stationDialog && <StationDialog plan={plan} station={stationDialog.station} onClose={() => setStationDialog(null)} />}
      {rowDialog && <RowDialog plan={plan} data={data} station={rowDialog} onClose={() => setRowDialog(null)} />}
      {filling && <FillDialog plan={plan} station={filling.station} onClose={() => setFilling(null)} />}
    </div>
  );
}
