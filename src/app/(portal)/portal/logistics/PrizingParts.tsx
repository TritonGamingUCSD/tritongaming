'use client';

import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, Lock, Minus, Pencil, Plus, TriangleAlert } from 'lucide-react';
import { RowMenu } from './RowMenu';
import { interactive } from './interactive';
import { Combo } from './Combo';
import { NumberCell } from './Cells';
import { money, needText, valueOf, type Fix } from '@/lib/logistics/prizing';
import { LEVELS, LEVEL_LABEL, isLoose, stepCeiling, type PrizeStepDef, type StockLevel } from '@/lib/logistics/prizes';
import type { Station } from './usePlans';
import type { PrizeRow } from './usePrizes';
import pz from './prizing.module.css';

export interface PrizingCtx {
  canStock: boolean;           // the numbers on hand can be changed (the Logistics permission)
  manage: boolean;             // the numbers on the stations can be changed (the permission, and the event is open)
  closed: boolean;
  sizeOrder: string[];
  shownSteps: PrizeStepDef[];  // the event-day steps shown as counters (Sorted by default)
  count: (lineId: string, stepId: string) => number;
  shown: (lineId: string, stepId: string, ceiling: number) => number;   // the count with the later steps taken into account (see impliedCount)
  givenOf: (lineId: string) => number;
  setLine: (stationId: string, prize: PrizeRow, n: number) => void;
  setCount: (lineId: string, stepId: string, n: number) => void;
  addCount: (lineId: string, stepId: string, delta: number) => void;   // a tap: added on the server, so two phones tapping both count
  editing: (key: string | null) => void;                             // this person opened (or left) a number box: others see "Sam is typing"
  heldBy: (key: string) => string | null;                            // someone else has that number box open
  flashing: (key: string) => boolean;                                // someone else just changed it
  setStock: (prize: PrizeRow, n: number) => void;
  setLevel: (prize: PrizeRow, level: StockLevel) => void;   // free merch: how much is left, instead of a count
  edit: (p: PrizeRow) => void;
  editFrom: (p: PrizeRow) => void;
  where: (p: PrizeRow) => void;   // where did they go: the count explained
  eventSlug: (p: PrizeRow) => string | null;   // the event a prize was received for, as its address name   // change where it is from (sponsor, event), from any view
  history: (p: PrizeRow) => void;
  locked: (s: Station) => boolean;   // the station's prize request is locked
}

// What the screen needs to know about one prize in this event.
export interface PrizeLine { id: string; station_id: string; quantity: number }
export interface Row { p: PrizeRow; sponsor: string | null; here: number; remaining: number; elsewhere: number; lines: PrizeLine[] }

// Free merch is not counted: its stock is a level, picked from a small list.
function LevelPick({ p, canEdit, ctx }: { p: PrizeRow; canEdit: boolean; ctx: PrizingCtx }) {
  if (!canEdit) return <LevelChip level={p.stock_level} />;
  return (
    <select className={pz.levelSelect} value={p.stock_level} onChange={(e) => ctx.setLevel(p, e.target.value as StockLevel)} aria-label={`How much ${p.name} is left`}>
      {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
    </select>
  );
}
function LevelChip({ level }: { level: StockLevel }) { return <span className={`${pz.levelChip} ${level === 'low' ? pz.levelLow : ''} ${level === 'out' ? pz.levelOut : ''}`}>{LEVEL_LABEL[level]}</span>; }

const leftClass = (n: number) => (n < 0 ? pz.leftBad : n === 0 ? pz.leftZero : pz.leftOk);

// What a prize is and where it is from, always shown with it. The origin has a line of its own, labelled "From": the sponsor (or the club) and the event it was received for. Below it: size, type, bin and the note.
function Tags({ p, sponsor, slug, onEditFrom }: { p: PrizeRow; sponsor: string | null; slug: string | null; onEditFrom?: () => void }) {
  const from = <><em>From</em><b>{sponsor ?? 'Club'}</b>{slug ? <><i aria-hidden="true">·</i><span>{slug}</span></> : <span className={pz.fromNone}>no event noted</span>}</>;
  return (
    <span className={pz.tagsBlock}>
      {onEditFrom ? <button type="button" className={`${pz.from} ${pz.fromBtn}`} title="Change where it is from" onClick={onEditFrom}>{from}<Pencil size={12} aria-hidden="true" /></button> : <span className={pz.from} title="Where it came from">{from}</span>}
      <span className={pz.tags}>
        {p.size && <span className={pz.tag}>{p.size.replace(/ Prizing$/, '')}</span>}
        {p.type && <span className={pz.tag}>{p.type}</span>}
        {!p.in_hand && <span className={`${pz.tag} ${pz.tagWarn}`}>Not here yet</span>}
        {p.bin && <span className={`${pz.tag} ${pz.tagPlain}`}>{p.bin}</span>}
        {p.source && <span className={pz.sourceNote}>{p.source}</span>}
      </span>
    </span>
  );
}

// ---- one count for one prize line at one step (Sorted 3 of 8) -----------------------------------------------------------------------------------------------------------------
// One prize: a box to tick. Up to twelve: tap to add one (and a minus). More than that: a number to type.
export function StepCell({ n, real = n, ceiling, label, disabled, onSet, onAdd, onEdit }: { n: number; real?: number; ceiling: number; label: string; disabled: boolean; onSet: (v: number) => void; onAdd: (d: number) => void; onEdit?: (on: boolean) => void }) {
  if (ceiling <= 0) return <span className={pz.cellNa} aria-hidden="true">–</span>;
  const full = n >= ceiling, implied = n > real;   // implied: a later step was counted, so this one counts too; tapping it makes it real
  if (ceiling > 12) return <span className={`${pz.cell} ${full ? pz.cellDone : n > 0 ? pz.cellPart : ''} ${implied ? pz.cellImplied : ''}`}><NumberCell compact value={n} canEdit={!disabled} label={`${label}, out of ${ceiling}`} onEdit={onEdit} onSave={(v) => onSet(Math.max(0, Math.min(ceiling, v ?? 0)))} /><small>/{ceiling}</small></span>;
  return (
    <span className={pz.cellWrap}>
      <button type="button" disabled={disabled} className={`${pz.cell} ${pz.cellBtn} ${full ? pz.cellDone : n > 0 ? pz.cellPart : ''} ${implied ? pz.cellImplied : ''}`} aria-pressed={full} aria-label={implied ? `${label}: ${n} of ${ceiling}, counted because a later step was. Tap to count it` : full ? `Undo ${label}` : `${label}: ${n} of ${ceiling}. Add one`}
        onClick={() => (implied ? onSet(n) : onAdd(full ? -n : 1))}>{ceiling === 1 ? (full ? '✓' : '') : `${n}/${ceiling}`}</button>
      {ceiling > 1 && n > 0 && !full && <button type="button" disabled={disabled} className={pz.cellMinus} aria-label={`Take one off ${label}`} onClick={() => onAdd(-1)}><Minus size={11} aria-hidden="true" /></button>}
    </span>
  );
}

const addLabel = (p: PrizeRow) => `${p.name}${p.size ? ` · ${p.size.replace(/ Prizing$/, '')}` : ''} (${isLoose(p) ? LEVEL_LABEL[p.stock_level].toLowerCase() : `${p.left} left`})`;

// One prize going to one station: the prize and where it is from, how many, how many are left and the event-day counters. `where` names the station when the lines are grouped by something else.
export function LineRow({ l, station, canEdit, ctx, where }: { l: StationLine; station: { id: string; name: string }; canEdit: boolean; ctx: PrizingCtx; where?: boolean }) {
  const given = ctx.givenOf(l.id);
  return (
              <div className={`${pz.line} ${ctx.flashing(`line:${l.id}`) ? pz.flash : ''}`} style={{ '--steps': ctx.shownSteps.length } as CSSProperties}>
                <div className={pz.rowMain}><b className={pz.lineName}>{l.p.name}</b><Tags p={l.p} sponsor={l.sponsor} slug={ctx.eventSlug(l.p)} onEditFrom={ctx.canStock ? () => ctx.editFrom(l.p) : undefined} />{where && <span className={pz.at}>At <b>{station.name}</b></span>}</div>
                <div className={pz.num} data-label="How many">{isLoose(l.p) ? <span className={pz.hasIt}>Has it</span> : <><NumberCell field value={l.quantity} canEdit={canEdit} label={`How many ${l.p.name} for ${station.name}`} onEdit={(on) => ctx.editing(on ? `line:${l.id}` : null)} onSave={(v) => { if (v !== null) ctx.setLine(station.id, l.p, v); }} />{ctx.heldBy(`line:${l.id}`) && <small className={pz.editor}>{ctx.heldBy(`line:${l.id}`)} is typing…</small>}{l.p.price !== null && <small className={pz.sub}>{money(l.quantity * l.p.price)}</small>}</>}</div>
                <div className={pz.num} data-label="Left">{isLoose(l.p) ? <LevelChip level={l.p.stock_level} /> : <span className={`${pz.chip} ${leftClass(l.p.left)}`}>{l.p.left}</span>}</div>
                {ctx.shownSteps.map((s) => (
                  <div key={s.id} className={pz.num} data-label={s.name}>
                    <StepCell n={ctx.shown(l.id, s.id, stepCeiling(s, l, given))} real={Math.min(ctx.count(l.id, s.id), stepCeiling(s, l, given))} ceiling={stepCeiling(s, l, given)} label={`${l.p.name} · ${s.name}`} disabled={ctx.closed} onSet={(v) => ctx.setCount(l.id, s.id, v)} onAdd={(d) => ctx.addCount(l.id, s.id, d)} onEdit={(on) => ctx.editing(on ? `count:${l.id}:${s.id}` : null)} />
                  </div>
                ))}
                <div className={pz.tools}>{canEdit && <RowMenu label={`More for ${l.p.name}`} items={[{ label: 'Take It Off This Station', danger: true, onClick: () => ctx.setLine(station.id, l.p, 0) }, { label: 'Where Did They Go?', onClick: () => ctx.where(l.p) }, { label: 'History', onClick: () => ctx.history(l.p) }]} />}</div>
              </div>
  );
}

// ---- a station with its prizes (Group by Station) -----------------------------------------------------------------------------------------------------------------------------------
export interface StationLine { id: string; quantity: number; p: PrizeRow; sponsor: string | null }
export function StationBlock({ station, lines, ctx, addable, need, asked, onAdd, onFill, onEdit, onRemove, onLock, flash, summary, onAll, open, onToggle }: {
  station: Station; lines: StationLine[]; ctx: PrizingCtx; addable: PrizeRow[]; need: Record<string, number>; asked: number; onAdd: (p: PrizeRow) => void; onFill?: () => void; onEdit: () => void; onRemove: () => void; onLock?: () => void; flash: boolean;
  summary: (stepId: string) => { done: number; total: number } | null; onAll?: (stepId: string) => void; open: boolean; onToggle: () => void;
}) {
  const counted = lines.filter((l) => !isLoose(l.p)), free = lines.length - counted.length;   // free merch is not counted or valued
  const total = counted.reduce((n, l) => n + l.quantity, 0);
  const lockedHere = ctx.locked(station);
  const canEdit = ctx.manage && !lockedHere;
  const short = needText(need, ctx.sizeOrder);
  return (
    <section id={`station-${station.id}`} className={`${pz.block} ${flash || ctx.flashing(`station:${station.id}`) ? pz.flash : ''}`} aria-label={station.name}>
      <header className={pz.blockHead} onClick={(e) => { if (!interactive(e.target) || (e.target as Element).closest(`.${pz.blockName}`)) onToggle(); }}>
        <button type="button" className={pz.blockName} aria-expanded={open}>{open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}<b>{station.name}</b></button>
        <span className={pz.blockMeta}>{total} {total === 1 ? 'prize' : 'prizes'}{free > 0 ? ` + ${free} free` : ''} · {money(valueOf(counted.map((l) => ({ quantity: l.quantity, price: l.p.price })))) || '$0'}{station.room ? ` · ${station.room}` : ''}</span>
        {asked > 0 && (short ? <span className={`${pz.badge} ${pz.badgeWarn}`}><TriangleAlert size={12} aria-hidden="true" /> Needs {short}</span> : <span className={`${pz.badge} ${pz.badgeOk}`}>Has what it asked for ({asked})</span>)}
        {lockedHere && <span className={pz.badge}><Lock size={11} aria-hidden="true" /> Locked</span>}
        <span className={pz.blockEnd}>
          {ctx.shownSteps.map((s) => { const x = summary(s.id); return x && x.total > 0 ? <span key={s.id} className={`${pz.stepHead} ${x.done >= x.total ? pz.stepDone : ''}`}><span>{s.name}</span><small>{x.done}/{x.total}</small>{onAll && !ctx.closed && x.done < x.total && <button type="button" className={pz.allBtn} onClick={() => onAll(s.id)} aria-label={`Mark every ${s.name} in ${station.name}`} title={`Mark all ${x.total - x.done} left as ${s.name}`}>All</button>}</span> : null; })}
          {ctx.manage && <RowMenu label={`More for ${station.name}`} items={[onFill && { label: 'Suggest Prizes For What It Asked', onClick: onFill }, onLock && { label: lockedHere ? 'Unlock Station' : 'Lock Station', onClick: onLock }, { label: 'Rename Station', onClick: onEdit }, { label: 'Remove Station', danger: true, onClick: onRemove }].filter(Boolean) as never} />}
        </span>
      </header>
      {open && (
        <>
          {lines.length === 0 && <p className={`${pz.muted} ${pz.pad}`}>No prizes yet.</p>}
          {lines.length > 0 && <div className={`${pz.line} ${pz.lineHead}`} style={{ '--steps': ctx.shownSteps.length } as CSSProperties} aria-hidden="true"><span>Prize</span><span>How many</span><span>Left</span>{ctx.shownSteps.map((s) => <span key={s.id}>{s.name}</span>)}<span /></div>}
          {lines.map((l) => <LineRow key={l.id} l={l} station={station} canEdit={canEdit} ctx={ctx} />)}
          {canEdit && (
            <div className={pz.blockAdd}>
              <Plus size={14} aria-hidden="true" />
              <Combo value={null} options={addable.map((p) => addLabel(p))} placeholder="Add a prize…" clearable={false} ariaLabel={`Add a prize to ${station.name}`}
                onChange={(v) => { const p = addable.find((x) => addLabel(x) === v); if (p) onAdd(p); }} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---- a group of this event's prize lines (Group by Sponsor, Source, Size, Type or Status): the same block as a station, each line says which station it is for -------------------------------------------------
export interface GroupLine extends StationLine { station: Station }
export function GroupBlock({ id, label, lines, ctx, summary, onAll, open, onToggle }: {
  id: string; label: string; lines: GroupLine[]; ctx: PrizingCtx; summary: (stepId: string) => { done: number; total: number } | null; onAll?: (stepId: string) => void; open: boolean; onToggle: () => void;
}) {
  const counted = lines.filter((l) => !isLoose(l.p)), free = lines.length - counted.length;
  const total = counted.reduce((n, l) => n + l.quantity, 0);
  return (
    <section id={id} className={pz.block} aria-label={label}>
      <header className={pz.blockHead} onClick={(e) => { if (!interactive(e.target) || (e.target as Element).closest(`.${pz.blockName}`)) onToggle(); }}>
        <button type="button" className={pz.blockName} aria-expanded={open}>{open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}<b>{label}</b></button>
        <span className={pz.blockMeta}>{total} {total === 1 ? 'prize' : 'prizes'}{free > 0 ? ` + ${free} free` : ''} · {money(valueOf(counted.map((l) => ({ quantity: l.quantity, price: l.p.price })))) || '$0'}</span>
        <span className={pz.blockEnd}>
          {ctx.shownSteps.map((s) => { const x = summary(s.id); return x && x.total > 0 ? <span key={s.id} className={`${pz.stepHead} ${x.done >= x.total ? pz.stepDone : ''}`}><span>{s.name}</span><small>{x.done}/{x.total}</small>{onAll && !ctx.closed && x.done < x.total && <button type="button" className={pz.allBtn} onClick={() => onAll(s.id)} aria-label={`Mark every ${s.name} in ${label}`}>All</button>}</span> : null; })}
        </span>
      </header>
      {open && (
        <>
          {lines.length > 0 && <div className={`${pz.line} ${pz.lineHead}`} style={{ '--steps': ctx.shownSteps.length } as CSSProperties} aria-hidden="true"><span>Prize</span><span>How many</span><span>Left</span>{ctx.shownSteps.map((s) => <span key={s.id}>{s.name}</span>)}<span /></div>}
          {lines.map((l) => <LineRow key={l.id} l={l} station={l.station} canEdit={ctx.manage && !ctx.locked(l.station)} ctx={ctx} where />)}
        </>
      )}
    </section>
  );
}

// ---- the stock (no event): the same blocks as an event, a group of prizes with what is on hand and left -------------------------------------------------------------------------------------------
export function StockBlock({ id, label, rows, ctx, open, onToggle }: { id: string; label: string; rows: Row[]; ctx: PrizingCtx; open: boolean; onToggle: () => void }) {
  const counted = rows.filter((r) => !isLoose(r.p)), free = rows.length - counted.length;
  return (
    <section id={id} className={pz.block} aria-label={label}>
      <header className={pz.blockHead} onClick={(e) => { if (!interactive(e.target) || (e.target as Element).closest(`.${pz.blockName}`)) onToggle(); }}>
        <button type="button" className={pz.blockName} aria-expanded={open}>{open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}<b>{label}</b></button>
        <span className={pz.blockMeta}>{counted.length} {counted.length === 1 ? 'prize' : 'prizes'}{free > 0 ? ` + ${free} free` : ''} · {money(valueOf(counted.map((r) => ({ quantity: r.p.quantity, price: r.p.price })))) || '$0'} in stock</span>
      </header>
      {open && (
        <>
          <div className={`${pz.line} ${pz.lineStock} ${pz.lineHead}`} aria-hidden="true"><span>Prize</span><span>In stock</span><span>Planned</span><span>Left</span><span /></div>
          {rows.map((r) => <StockLine key={r.p.id} row={r} ctx={ctx} />)}
        </>
      )}
    </section>
  );
}
function StockLine({ row, ctx }: { row: Row; ctx: PrizingCtx }) {
  const { p } = row;
  return (
    <div id={`prize-${p.id}`} className={`${pz.line} ${pz.lineStock} ${ctx.flashing(`prize:${p.id}`) ? pz.flash : ''} ${p.left < 0 ? pz.rowBad : ''}`}>
      <div className={pz.rowMain}><b className={pz.lineName}>{p.name}</b><Tags p={p} sponsor={row.sponsor} slug={ctx.eventSlug(p)} onEditFrom={ctx.canStock ? () => ctx.editFrom(p) : undefined} /></div>
      <div className={pz.num} data-label="In stock">{isLoose(p) ? <LevelPick p={p} canEdit={ctx.canStock} ctx={ctx} /> : <><NumberCell field value={p.quantity} canEdit={ctx.canStock} label={`How many ${p.name} are on hand`} onEdit={(on) => ctx.editing(on ? `prize:${p.id}` : null)} onSave={(v) => { if (v !== null && v !== p.quantity) ctx.setStock(p, v); }} />{ctx.heldBy(`prize:${p.id}`) && <small className={pz.typing}>{ctx.heldBy(`prize:${p.id}`)} is typing</small>}</>}</div>
      <div className={pz.num} data-label="Planned" title={p.used_at.length ? `Planned or used at ${p.used_at.join(', ')}` : 'Not planned for any event'}>{isLoose(p) ? <span>–</span> : <button type="button" className={pz.numLink} onClick={() => ctx.where(p)} aria-label={`${p.allocated} planned. Where did ${p.name} go?`}>{p.allocated}</button>}</div>
      <div className={pz.num} data-label="Left">{isLoose(p) ? <LevelChip level={p.stock_level} /> : <span className={`${pz.chip} ${leftClass(p.left)}`}>{p.left}</span>}</div>
      <div className={pz.tools}><RowMenu label={`More for ${p.name}`} items={[{ label: 'Edit Details', onClick: () => ctx.edit(p) }, { label: 'Where Did They Go?', onClick: () => ctx.where(p) }, { label: 'Where It Is From', onClick: () => ctx.editFrom(p) }, { label: 'History', onClick: () => ctx.history(p) }]} /></div>
    </div>
  );
}

// ---- the "Fix these" strip ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export function FixStrip({ fixes, onFocus }: { fixes: Fix[]; onFocus: (f: Fix['focus']) => void }) {
  const [open, setOpen] = useState(true);
  if (!fixes.length) return null;
  const bad = fixes.filter((f) => f.sev === 'bad').length;
  return (
    <section className={`${pz.fix} ${bad ? pz.fixBad : ''}`} aria-label="Fix these">
      <button type="button" className={pz.fixHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <CircleAlert size={15} aria-hidden="true" /><b>{fixes.length} to fix</b>
        <span className={pz.fixSub}>{bad ? `${bad} over-promised` : 'nothing is over-promised'}</span>{open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
      </button>
      {open && <ul>{fixes.map((f, i) => <li key={i}><button type="button" className={`${pz.fixItem} ${f.sev === 'bad' ? pz.fixItemBad : ''}`} onClick={() => onFocus(f.focus)}>{f.text}</button></li>)}</ul>}
    </section>
  );
}
