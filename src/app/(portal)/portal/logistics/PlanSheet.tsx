'use client';

import { useState } from 'react';
import { ArrowRightLeft, Check, Pencil, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { conditionLabel, UNUSABLE } from '@/lib/logistics/constants';
import { rowKind, skippedSteps, stepAppliesTo, type Problem, type StepDef } from '@/lib/logistics/plans';
import { interactive } from './interactive';
import { units, type Line, type Row, type Unit } from './planRows';
import type { Slim, Station, usePlan } from './usePlans';
import styles from './logistics.module.css';

export interface SheetCtx {
  api: ReturnType<typeof usePlan>; canManage: boolean; closed: boolean; busy: boolean; stations: Station[]; steps: StepDef[]; activeId: string;
  doneSet: Set<string>; doneAt: Map<string, string>; problems: Problem[];
  onTick: (row: Row, step: StepDef) => void; onTickAll: (rows: Row[], step: StepDef) => void; onUndo: (item: { id: string; kind: Slim['kind'] }, stepId: string) => void;
  onSwap: (r: Row) => void; onBorrowed: (r: Row) => void; onInstalled: (rows: Row[]) => void;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const missingOf = (r: Row) => (r.kind !== 'slot' ? r.games_needed.filter((g) => !r.games.some((x) => x.toLowerCase() === g.toLowerCase())) : []);
const label = (r: Row) => r.tag ?? r.type;

// The boxes for one line: a box per step the line goes through (a dash for a step that doesn't apply). A single device ticks and unticks; a counted line shows how many units are done
// and ticks the next unit; a set ticks the step for all of its parts that go through it, and shows how many are done while some are not.
function Cells({ rows, setLabel, ctx, readOnly }: { rows: Row[]; setLabel?: string; ctx: SheetCtx; readOnly?: boolean }) {
  const { steps, doneSet, doneAt, activeId, closed, busy, onTick, onTickAll, onUndo } = ctx;
  const skipped = new Set(rows.flatMap((x) => skippedSteps(x, steps, doneSet).map((s) => s.id)));
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
        const click = () => {
          if (closed || busy) return;
          if (full) { for (const x of done) onUndo({ id: x.id, kind: x.kind }, s.id); return; }
          const next = mine.filter((x) => !doneSet.has(`${x.id}:${s.id}`));
          if (single || s.kit) onTick(next[0], s);
          else if (setLabel !== undefined) onTickAll(next, s);
          else onTick(next[0], s);
        };
        return (
          <span key={s.id} className={`${styles.cellWrap} ${s.id === activeId ? styles.cellOn : ''}`}>
            <button type="button" className={`${styles.cell} ${full ? styles.cellDone : done.length ? styles.cellPart : ''} ${!full && skipped.has(s.id) ? styles.cellSkipped : ''}`} disabled={closed || busy} onClick={click} aria-pressed={full} aria-label={full ? `Undo ${name}` : `Mark ${name}`} title={lastDone ? `Done at ${time(lastDone)}` : skipped.has(s.id) ? 'Skipped: a later step is done' : s.name}>
              {!single && !full ? <span>{done.length}/{mine.length}</span> : full ? <Check size={18} aria-hidden="true" /> : <span className={styles.cellBox} />}
              <span className={styles.cellLabel}>{s.name}</span>
            </button>
            {!single && setLabel === undefined && done.length > 0 && !full && <button type="button" className={styles.cellMinus} aria-label={`Undo one ${name}`} disabled={closed || busy} onClick={() => onUndo({ id: done[done.length - 1].id, kind: done[done.length - 1].kind }, s.id)}>−</button>}
          </span>
        );
      })}
    </div>
  );
}

// One device (or one counted line) with everything about it: what and where, what's wrong, its step boxes, and the tools to change it.
function DeviceLine({ line, ctx, backup, nested }: { line: Line; ctx: SheetCtx; backup?: boolean; nested?: boolean }) {
  const { api, canManage, closed, stations, problems, onSwap, onBorrowed } = ctx;
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const r = line.rows[0];
  const manage = canManage && !closed;
  const dead = !!r.condition && UNUSABLE.includes(r.condition as never);
  const empty = r.kind === 'slot' && !r.counted;
  const missing = missingOf(r);
  const flags = problems.filter((p) => p.row_id === r.id && p.why === 'conflict');
  const skip = line.rows.flatMap((x) => skippedSteps(x, ctx.steps, ctx.doneSet));
  const bad = dead || empty || skip.length > 0 || flags.some((p) => p.sev === 'bad');
  const moveTo = (station_id: string | null) => (r.kind === 'club' ? api.act('/devices', 'PATCH', { device_ids: [r.id], station_id }) : r.kind === 'slot' ? api.act('/slots', 'PATCH', { slot_id: r.id, station_id }) : api.act('/borrowed', 'PATCH', { borrowed_id: r.id, station_id }));
  const takeOut = () => (r.kind === 'club' ? api.act('/devices', 'DELETE', { device_ids: [r.id] }) : r.kind === 'slot' ? api.act('/slots', 'DELETE', { slot_id: r.id }) : api.act('/borrowed', 'DELETE', { borrowed_id: r.id }));
  async function assign() { if (!tag.trim() || busy) return; setBusy(true); const ok = await api.assign(r.id, tag.trim()); setBusy(false); if (ok) setTag(''); }
  const skipNames = [...new Set(skip.map((s) => s.name))].join(', ');

  return (
    <div className={`${styles.dayRow} ${styles.dayLine} ${nested ? styles.nested : ''} ${bad ? styles.lineBad : missing.length || flags.length ? styles.lineWarn : ''}`}>
      <div className={styles.dInfo}>
        {empty ? <b className={styles.emptyMark}>Needs a {r.type}</b> : <b className={styles.dTag}>{line.counted ? `${r.type} ×${line.rows.length}` : r.tag ?? r.type}</b>}
        {!empty && <span className={styles.dType}>{line.counted ? 'counted' : `${r.type}${r.name ? ` · ${r.name}` : ''}`}</span>}
        {(r.kind === 'sponsor' || r.kind === 'officer') && <span className={styles.ownerTag}>{r.kind === 'sponsor' ? 'Sponsor' : 'Loaner'}</span>}
        {r.kind !== 'slot' && r.where && <span className={styles.dWhere}>{r.where}</span>}
        {r.kind === 'slot' && r.label && <span className={styles.dWhere}>{r.label}</span>}
      </div>
      <div className={styles.dNotes}>
        {r.games_needed.length > 0 && <span className={`${styles.gameChip} ${missing.length ? styles.gameMissing : styles.gameOk}`} title={missing.length ? `Not installed yet: ${missing.join(', ')}` : r.kind === 'slot' ? 'Needed' : 'Installed'}>{r.games_needed.join(', ')}{missing.length ? ' · not installed' : ''}</span>}
        {missing.length > 0 && manage && r.kind === 'club' && <button type="button" className={styles.linkBtn} disabled={ctx.busy} onClick={() => ctx.onInstalled([r])} title={`Add ${missing.join(', ')} to this device’s installed games`}>Mark installed</button>}
        {empty && manage && (
          <span className={styles.assignRow}>
            <input className={styles.assignInput} value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void assign(); }} placeholder="Type an ID" aria-label={`Device ID for the ${r.type} row`} autoCapitalize="characters" autoComplete="off" disabled={busy} />
            <Button size="sm" variant="secondary" onClick={assign} loading={busy} disabled={!tag.trim()}>Use</Button>
          </span>
        )}
        {dead && <span className={`${styles.badge} ${styles.bad}`}>{conditionLabel(r.condition!)}</span>}
        {!dead && !flags.length && r.condition && r.condition !== 'working' && r.condition !== 'brand_new' && <span className={`${styles.badge} ${styles.neutral}`}>{conditionLabel(r.condition)}</span>}
        {flags.filter(() => !dead).map((p, i) => <span key={i} className={p.sev === 'bad' ? styles.flagBad : styles.flagWarn}>{p.text}</span>)}
        {skipNames && <span className={styles.flagBad}>Skipped: {skipNames}</span>}
        {backup && r.swap_reason && <span className={styles.dim}>Swapped out for {r.swapped_for_label}: {r.swap_reason}</span>}
      </div>
      <Cells rows={line.rows} ctx={ctx} readOnly={backup} />
      <div className={styles.dTools}>
        {!closed && !backup && r.kind !== 'slot' && <button type="button" className={styles.iconBtn} aria-label={`Swap ${r.tag}`} title="Swap for another device" onClick={() => onSwap(r)}><ArrowRightLeft size={14} aria-hidden="true" /></button>}
        {manage && (r.kind === 'sponsor' || r.kind === 'officer') && <button type="button" className={styles.iconBtn} aria-label={`Edit ${r.tag}`} onClick={() => onBorrowed(r)}><Pencil size={14} aria-hidden="true" /></button>}
        {manage && !backup && !line.counted && (
          <select className={styles.miniSelect} aria-label={`Team for ${label(r)}`} value={r.station_id ?? ''} onChange={(e) => void moveTo(e.target.value || null)}>
            <option value="">No team</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {manage && <button type="button" className={styles.iconBtn} aria-label={`Remove ${label(r)} from the plan`} onClick={() => void takeOut()}><X size={14} aria-hidden="true" /></button>}
      </div>
    </div>
  );
}

// A set shows as one line: its parts side by side, one box per step for the whole set. "Parts" opens the line of each part, to tick one alone or to change it.
function SetLine({ unit, ctx }: { unit: Unit; ctx: SheetCtx }) {
  const [open, setOpen] = useState(false);
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
      <div className={`${styles.dayRow} ${styles.dayLine} ${styles.setLine} ${styles.clickRow} ${bad ? styles.lineBad : warn ? styles.lineWarn : ''}`} onClick={(e) => { if (!interactive(e.target)) setOpen((v) => !v); }}>
        <div className={styles.dInfo}>
          <button type="button" className={styles.foldBtn} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} the parts of ${first.tag ?? first.type}`} onClick={() => setOpen((v) => !v)}><span className={styles.foldMark} aria-hidden="true">{open ? '–' : '+'}</span><b className={styles.dTag}>{first.tag ?? first.type}</b></button>
          <span className={styles.dType}>{first.type} set · {rows.length} parts</span>
          <span className={`${styles.dWhere} ${styles.setParts}`} title={name}>{unit.lines.map((l, i) => (
            <span key={l.key} className={l.rows[0].kind === 'slot' && !l.counted ? styles.flagBad : undefined}>{i > 0 ? ' · ' : ''}{l.counted ? `${l.rows[0].type}${l.rows.length > 1 ? ` ×${l.rows.length}` : ''}` : l.rows[0].kind === 'slot' ? `no ${l.rows[0].type}` : label(l.rows[0])}</span>
          ))}</span>
        </div>
        <div className={styles.dNotes}>
          {games.length > 0 && <span className={`${styles.gameChip} ${missingGames.length ? styles.gameMissing : styles.gameOk}`}>{games.join(', ')}{missingGames.length ? ' · not installed' : ''}</span>}
          {missingGames.length > 0 && !ctx.closed && ctx.canManage && rows.some((r) => r.kind === 'club' && missingOf(r).length) && <button type="button" className={styles.linkBtn} disabled={ctx.busy} onClick={() => ctx.onInstalled(rows)}>Mark installed</button>}
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
  return <>{units(rows).map((u) => (u.set && !backup ? <SetLine key={u.key} unit={u} ctx={ctx} /> : u.lines.map((l) => <DeviceLine key={l.key} line={l} ctx={ctx} backup={backup} />)))}</>;
}
