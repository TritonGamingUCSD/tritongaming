'use client';

import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { conditionLabel, UNUSABLE } from '@/lib/logistics/constants';
import { rowKind, skippedSteps, stepAppliesTo, type Problem, type StepDef } from '@/lib/logistics/plans';
import { Suggest } from './Combo';
import { RowMenu } from './RowMenu';
import { interactive } from './interactive';
import { units, type Line, type Row, type Unit } from './planRows';
import type { Slim, Station, usePlan } from './usePlans';
import { tapTwice } from './cellNav';
import styles from './logistics.module.css';

export interface SheetCtx {
  api: ReturnType<typeof usePlan>; canManage: boolean; closed: boolean; manager: boolean; busy: boolean; pending: Set<string>; day: boolean; stations: Station[]; steps: StepDef[]; activeId: string;
  hideDone: boolean; ids: (type: string) => { value: string }[]; setsOpen: boolean; foldGen: number; byType: boolean; main: Set<string>; doneSet: Set<string>; doneAt: Map<string, string>; doneBy: Map<string, string>; problems: Problem[];
  onTick: (row: Row, step: StepDef) => void; onTickAll: (rows: Row[], step: StepDef) => void; onUndo: (item: { id: string; kind: Slim['kind'] }, stepId: string) => void;
  onSwap: (r: Row) => void; onBorrowed: (r: Row) => void; onInstalled: (rows: Row[]) => void; onEditDevice: (r: Row) => void;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const missingOf = (r: Row) => (r.kind !== 'slot' ? r.games_needed.filter((g) => !r.games.some((x) => x.toLowerCase() === g.toLowerCase())) : []);
const label = (r: Row) => r.tag ?? r.type;

// The boxes for one line: a box per step the line goes through (a dash for a step that doesn't apply). A single device ticks and unticks; a counted line shows how many units are done
// and ticks the next unit; a set ticks the step for all of its parts that go through it, and shows how many are done while some are not.
function Cells({ rows, setLabel, ctx, readOnly }: { rows: Row[]; setLabel?: string; ctx: SheetCtx; readOnly?: boolean }) {
  const { steps, doneSet, doneAt, doneBy, activeId, closed, pending, onTick, onTickAll, onUndo } = ctx;
  const skipped = new Set(rows.flatMap((x) => skippedSteps(x, steps, doneSet).map((s) => s.id)));
  if (!ctx.day) return null;   // while allocating, the step boxes are hidden: they are for the day
  return (
    <div className={styles.dCells}>
      {steps.map((s) => {
        const mine = rows.filter((x) => stepAppliesTo(s, rowKind(x)));
        if (!mine.length || readOnly) return <span key={s.id} className={`${styles.cell} ${styles.cellNa}`} aria-hidden="true">–</span>;
        const done = mine.filter((x) => doneSet.has(`${x.id}:${s.id}`));
        const full = done.length === mine.length;
        const lastDone = done.length ? doneAt.get(`${done[done.length - 1].id}:${s.id}`) : null;
        const name = `${setLabel ?? label(mine[0])} · ${s.name}`;
        const single = mine.length === 1;
        const wait = mine.some((x) => pending.has(`${x.id}:${s.id}`));
        const click = () => {
          if (closed || wait) return;
          if (full) { for (const x of done) onUndo({ id: x.id, kind: x.kind }, s.id); return; }
          const next = mine.filter((x) => !doneSet.has(`${x.id}:${s.id}`));
          if (single || s.kit) onTick(next[0], s);
          else if (setLabel !== undefined) onTickAll(next, s);
          else onTick(next[0], s);
        };
        return (
          <span key={s.id} className={`${styles.cellWrap} ${s.id === activeId ? styles.cellOn : ''}`}>
            <button type="button" className={`${styles.cell} ${full ? styles.cellDone : done.length ? styles.cellPart : ''} ${!full && skipped.has(s.id) ? styles.cellSkipped : ''} ${wait ? styles.cellWait : ''}`} disabled={closed} aria-busy={wait} onClick={click} aria-pressed={full} aria-label={full ? `Undo ${name}` : `Mark ${name}`} title={lastDone ? `Done at ${time(lastDone)}${doneBy.get(`${done[done.length - 1].id}:${s.id}`) ? ` by ${doneBy.get(`${done[done.length - 1].id}:${s.id}`)}` : ''}` : skipped.has(s.id) ? 'Skipped: a later step is done' : s.name}>
              {!single && !full ? <span className={`${styles.cellMark} ${styles.cellCount}`}>{done.length}/{mine.length}</span> : <span className={styles.cellMark}>{full ? <Check size={18} aria-hidden="true" /> : <span className={styles.cellBox} />}</span>}
              <span className={styles.cellLabel}>{s.name}</span>
            </button>
            {!single && setLabel === undefined && done.length > 0 && !full && <button type="button" className={styles.cellMinus} aria-label={`Undo one ${name}`} disabled={closed || wait} onClick={() => onUndo({ id: done[done.length - 1].id, kind: done[done.length - 1].kind }, s.id)}>−</button>}
          </span>
        );
      })}
    </div>
  );
}

// One device (or one counted line) with everything about it: what and where, what's wrong, its step boxes, and the tools to change it.
const rowKind0 = (l: Line) => (l.rows[0].kind === 'slot' ? '' : l.rows[0].tag ?? '');
function DeviceLine({ line, ctx, backup, nested }: { line: Line; ctx: SheetCtx; backup?: boolean; nested?: boolean }) {
  const { api, canManage, closed, stations, problems, onSwap, onBorrowed } = ctx;
  const [tag, setTag] = useState(() => (rowKind0(line)));
  const [editingTag, setEditingTag] = useState(false);
  const [busy, setBusy] = useState(false);
  const r = line.rows[0];
  const manage = canManage && !closed;
  const dead = !!r.condition && UNUSABLE.includes(r.condition as never);
  const empty = r.kind === 'slot' && !r.counted;
  const missing = missingOf(r);
  const flags = problems.filter((p) => p.row_id === r.id && p.why === 'conflict');
  const skip = line.rows.flatMap((x) => skippedSteps(x, ctx.steps, ctx.doneSet));
  const bad = dead || empty || skip.length > 0 || flags.some((p) => p.sev === 'bad');
  const loan = r.kind === 'sponsor' || r.kind === 'officer';
  const fromRequest = r.kind !== 'slot' && !!r.requestId;
  const empty0 = () => api.act('/slots', 'POST', { action: 'empty', ...(loan ? { borrowed_id: r.id } : { device_id: r.id }) });
  const takeOut = () => (r.kind === 'club' ? api.act('/devices', 'DELETE', { device_ids: [r.id] }) : r.kind === 'slot' ? api.act('/slots', 'DELETE', { slot_id: r.id }) : api.act('/borrowed', 'DELETE', { borrowed_id: r.id }));
  // Allocation: each row is what was asked for, and its ID box is where the device goes. Typing an ID fills an empty row or swaps the device; clearing it empties the row.
  const alloc = manage && !ctx.day && !backup && !line.counted;
  async function commit() {
    const v = tag.trim();
    if (busy || (r.kind !== 'slot' && v.toLowerCase() === (r.tag ?? '').toLowerCase())) return;
    setBusy(true);
    if (r.kind === 'slot') { if (v) await api.assign(r.id, v); }
    else if (!v) { if (fromRequest) await empty0(); else setTag(r.tag ?? ''); }
    else if (!(await api.act('/slots', 'POST', { action: 'assign', ...(loan ? { borrowed_id: r.id } : { device_id: r.id }), tag: v }))) setTag(r.tag ?? '');
    setBusy(false);
  }
  const skipNames = [...new Set(skip.map((s) => s.name))].join(', ');

  return (
    <div data-rows={line.rows.map((x) => x.id).join(' ')} className={`${styles.dayRow} ${styles.dayLine} ${nested ? styles.nested : ''} ${bad ? styles.lineBad : missing.length || flags.length ? styles.lineWarn : ''}`}>
      <div className={styles.dInfo}>
        {alloc ? <b className={styles.dTag}>{r.type}</b> : empty ? <b className={styles.emptyMark}>Needs a {r.type}</b> : <b className={styles.dTag}>{line.counted ? `${r.type} ×${line.rows.length}` : r.tag ?? r.type}</b>}
        {!empty && !alloc && <span className={styles.dType}>{line.counted ? 'counted' : ctx.byType ? r.name : `${r.type}${r.name ? ` · ${r.name}` : ''}`}</span>}
        {ctx.byType && !backup && <span className={styles.teamTag}>{stations.find((x) => x.id === r.stationId)?.name ?? 'No team'}</span>}
        {(r.kind === 'sponsor' || r.kind === 'officer') && <span className={styles.ownerTag}>{r.kind === 'sponsor' ? 'Sponsor' : 'Loaner'}</span>}
        {r.kind !== 'slot' && r.where && (r.located ? <span className={styles.dWhere}>{r.where}</span> : <span className={`${styles.dWhere}`}><span className={styles.notLocated}>Not located yet</span>{r.where.includes(' · ') ? ` ${r.where.replace(/^No place set · /, '')}` : ''}</span>)}
        {r.kind === 'slot' && r.label && <span className={styles.dWhere}>{r.label}</span>}
      </div>
      <div className={styles.dNotes}>
        {alloc && (editingTag
          ? <Suggest autoFocus className={styles.assignInput} value={tag} onChange={setTag} options={ctx.ids(r.type)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') { setTag(r.tag ?? ''); setEditingTag(false); } }} onBlur={() => { setEditingTag(false); void commit(); }} placeholder="Device ID" aria-label={`Device ID for ${r.type}`} autoCapitalize="characters" disabled={busy} />
          : <button type="button" className={`${styles.assignBtn} ${empty ? styles.assignEmpty : ''}`} onClick={(e) => tapTwice(e, () => setEditingTag(true))} disabled={busy} aria-label={`Device ID for ${r.type}. Change`}>{tag || 'Device ID'}</button>)}
        {r.games_needed.length > 0 && <span className={`${styles.gameChip} ${missing.length ? styles.gameMissing : styles.gameOk}`} title={missing.length ? `Not installed yet: ${missing.join(', ')}` : r.kind === 'slot' ? 'Needed' : 'Installed'}>{r.games_needed.join(', ')}{missing.length ? ' · not installed' : ''}</span>}
        {missing.length > 0 && manage && r.kind !== 'slot' && <button type="button" className={styles.miniTextBtn} disabled={ctx.busy} title="Mark the needed games as installed" aria-label={`Mark ${label(r)} installed`} onClick={() => ctx.onInstalled([r])}>Mark installed</button>}
        {dead && <span className={`${styles.badge} ${styles.bad}`}>{conditionLabel(r.condition!)}</span>}
        {!dead && !flags.length && r.condition && r.condition !== 'working' && r.condition !== 'brand_new' && <span className={`${styles.badge} ${styles.neutral}`}>{conditionLabel(r.condition)}</span>}
        {flags.filter(() => !dead).map((p, i) => <span key={i} className={p.sev === 'bad' ? styles.flagBad : styles.flagWarn}>{p.text}</span>)}
        {skipNames && <span className={styles.flagBad}>Skipped: {skipNames}</span>}
        {backup && r.swap_reason && <span className={styles.dim}>Swapped out for {r.swapped_for_label}: {r.swap_reason}</span>}
      </div>
      <Cells rows={line.rows} ctx={ctx} readOnly={backup} />
      <div className={styles.dTools}>
        <RowMenu label={`More for ${label(r)}`} items={[
          r.kind === 'club' && !ctx.day && { label: canManage ? 'Edit Device' : 'Details', onClick: () => ctx.onEditDevice(r) },
          manage && (r.kind === 'sponsor' || r.kind === 'officer') && { label: 'Edit Borrowed Device', onClick: () => onBorrowed(r) },
          ctx.manager && !closed && !backup && r.kind !== 'slot' && { label: 'Swap', onClick: () => onSwap(r) },
          manage && backup && !!r.swap_reason && r.kind !== 'slot' && { label: 'Undo Swap', onClick: () => void api.unswap({ id: r.id, kind: r.kind as 'club' | 'sponsor' | 'officer' }) },
          manage && !fromRequest && !(backup && r.swap_reason) && r.kind !== 'slot' && { label: 'Remove From Plan', danger: true, onClick: () => void takeOut() },
        ]} />
      </div>
    </div>
  );
}

// A set shows as one line: its parts side by side, one box per step for the whole set. "Parts" opens the line of each part, to tick one alone or to change it.
function SetLine({ unit, ctx }: { unit: Unit; ctx: SheetCtx }) {
  const [open, setOpen] = useState(ctx.setsOpen);   // allocating: the parts start open, each with its ID box; Collapse all folds them
  const rows = unit.lines.flatMap((l) => l.rows);
  const first = unit.lines[0].rows[0];
  const bad = rows.some((r) => (r.kind === 'slot' && !r.counted) || (r.condition && UNUSABLE.includes(r.condition as never))) || rows.some((r) => skippedSteps(r, ctx.steps, ctx.doneSet).length > 0) || ctx.problems.some((p) => p.sev === 'bad' && rows.some((r) => r.id === p.row_id));
  const warn = !bad && (rows.some((r) => missingOf(r).length) || ctx.problems.some((p) => rows.some((r) => r.id === p.row_id)));
  const games = [...new Set(rows.flatMap((r) => r.games_needed))];
  const missingGames = [...new Set(rows.flatMap(missingOf))];
  const nEmpty = rows.filter((r) => r.kind === 'slot' && !r.counted).length;
  const name = unit.lines.map((l) => (l.counted ? `${l.rows[0].type}${l.rows.length > 1 ? ` ×${l.rows.length}` : ''}` : label(l.rows[0]))).join(' · ');
  return (
    <>
      <div data-rows={rows.map((x) => x.id).join(' ')} className={`${styles.dayRow} ${styles.dayLine} ${styles.setLine} ${ctx.day ? styles.daySet : ''} ${styles.clickRow} ${bad ? styles.lineBad : warn ? styles.lineWarn : ''}`} onClick={(e) => { if (!interactive(e.target)) setOpen((v) => !v); }}>
        <div className={styles.dInfo}>
          <button type="button" className={styles.foldBtn} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} the parts of ${first.tag ?? first.type}`} onClick={() => setOpen((v) => !v)}><span className={styles.foldMark} aria-hidden="true">{open ? <Minus size={13} strokeWidth={2.4} /> : <Plus size={13} strokeWidth={2.4} />}</span><b className={styles.dTag}>{ctx.day ? first.tag ?? first.type : first.requestItem ?? first.tag ?? first.type}</b></button>
          <span className={styles.dType}>{ctx.day ? `${first.type} set · ` : ''}{rows.length} parts</span>
          {!open && !ctx.day && <span className={`${styles.dWhere} ${styles.setParts}`} title={name}>{unit.lines.map((l, i) => (
            <span key={l.key} className={l.rows[0].kind === 'slot' && !l.counted ? styles.flagBad : undefined}>{i > 0 ? ' · ' : ''}{l.counted ? `${l.rows[0].type}${l.rows.length > 1 ? ` ×${l.rows.length}` : ''}` : l.rows[0].kind === 'slot' ? `no ${l.rows[0].type}` : label(l.rows[0])}</span>
          ))}</span>}
        </div>
        <div className={styles.dNotes}>
          {games.length > 0 && <span className={`${styles.gameChip} ${missingGames.length ? styles.gameMissing : styles.gameOk}`}>{games.join(', ')}{missingGames.length ? ' · not installed' : ''}</span>}
          {missingGames.length > 0 && !ctx.closed && ctx.canManage && rows.some((r) => r.kind !== 'slot' && missingOf(r).length) && <button type="button" className={styles.miniTextBtn} disabled={ctx.busy} title="Mark the needed games as installed" aria-label={`Mark ${name} installed`} onClick={() => ctx.onInstalled(rows)}>Mark installed</button>}
          {nEmpty > 0 && <span className={styles.flagBad}>{nEmpty} empty</span>}
          {bad && nEmpty === 0 && <span className={styles.flagBad}>Needs a look</span>}
          {!bad && warn && <span className={styles.flagWarn}>Check</span>}
        </div>
        <Cells rows={rows} setLabel={name} ctx={ctx} />
        <div className={styles.dTools} />
      </div>
      {open && unit.lines.map((l) => <DeviceLine key={l.key} line={l} ctx={ctx} nested />)}
    </>
  );
}

export function SheetRows({ rows, ctx, backup }: { rows: Row[]; ctx: SheetCtx; backup?: boolean }) {
  const allDone = (u: Unit) => u.lines.every((l) => l.rows.every((r) => ctx.steps.every((s) => !stepAppliesTo(s, rowKind(r)) || ctx.doneSet.has(`${r.id}:${s.id}`))));
  return <>{units(rows, ctx.main).filter((u) => !(ctx.hideDone && !backup && allDone(u))).map((u) => (u.set && !backup ? <SetLine key={`${u.key}:${ctx.foldGen}`} unit={u} ctx={ctx} /> : u.lines.map((l) => <DeviceLine key={l.key} line={l} ctx={ctx} backup={backup} />)))}</>;
}
