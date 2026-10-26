'use client';

import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, Minus, Plus, TriangleAlert } from 'lucide-react';
import { RowMenu } from './RowMenu';
import { Combo } from './Combo';
import { NumberCell } from './Cells';
import { money, needText, valueOf, type Fix } from '@/lib/logistics/prizing';
import { stepCeiling, type PrizeStepDef } from '@/lib/logistics/prizes';
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
  givenOf: (lineId: string) => number;
  setLine: (stationId: string, prize: PrizeRow, n: number) => void;
  setCount: (lineId: string, stepId: string, n: number) => void;
  addCount: (lineId: string, stepId: string, delta: number) => void;   // a tap: added on the server, so two phones tapping both count
  editing: (key: string | null) => void;                             // this person opened (or left) a number box: others see "Sam is typing"
  heldBy: (key: string) => string | null;                            // someone else has that number box open
  flashing: (key: string) => boolean;                                // someone else just changed it
  setStock: (prize: PrizeRow, n: number) => void;
  edit: (p: PrizeRow) => void;
  history: (p: PrizeRow) => void;
  locked: (s: Station) => boolean;   // the station's prize request is locked
}

// What the screen needs to know about one prize in this event.
export interface PrizeLine { id: string; station_id: string; quantity: number }
export interface Row { p: PrizeRow; sponsor: string | null; here: number; remaining: number; elsewhere: number; lines: PrizeLine[] }

const leftClass = (n: number) => (n < 0 ? pz.leftBad : n === 0 ? pz.leftZero : pz.leftOk);

// What a prize is and where it is from, always shown with it: the sponsor (or the club), the event it was received for, its size and type, the bin it is in and the note about where it came from.
function Tags({ p, sponsor }: { p: PrizeRow; sponsor: string | null }) {
  return (
    <span className={pz.tags}>
      <span className={`${pz.tag} ${pz.tagFrom}`} title="Where it is from">{sponsor ?? 'Club'}{p.from_event ? ` · ${p.from_event}` : ''}</span>
      {p.size && <span className={pz.tag}>{p.size.replace(/ Prizing$/, '')}</span>}
      {p.type && <span className={pz.tag}>{p.type}</span>}
      {!p.in_hand && <span className={`${pz.tag} ${pz.tagWarn}`}>Not here yet</span>}
      {p.bin && <span className={`${pz.tag} ${pz.tagPlain}`}>{p.bin}</span>}
      {p.source && <span className={pz.sourceNote}>{p.source}</span>}
    </span>
  );
}

// ---- one count for one prize line at one step (Sorted 3 of 8) -----------------------------------------------------------------------------------------------------------------
// One prize: a box to tick. Up to twelve: tap to add one (and a minus). More than that: a number to type.
export function StepCell({ n, ceiling, label, disabled, onSet, onAdd, onEdit }: { n: number; ceiling: number; label: string; disabled: boolean; onSet: (v: number) => void; onAdd: (d: number) => void; onEdit?: (on: boolean) => void }) {
  if (ceiling <= 0) return <span className={pz.cellNa} aria-hidden="true">–</span>;
  const full = n >= ceiling;
  if (ceiling > 12) return <span className={`${pz.cell} ${full ? pz.cellDone : n > 0 ? pz.cellPart : ''}`}><NumberCell compact value={n} canEdit={!disabled} label={`${label}, out of ${ceiling}`} onEdit={onEdit} onSave={(v) => onSet(Math.max(0, Math.min(ceiling, v ?? 0)))} /><small>/{ceiling}</small></span>;
  return (
    <span className={pz.cellWrap}>
      <button type="button" disabled={disabled} className={`${pz.cell} ${pz.cellBtn} ${full ? pz.cellDone : n > 0 ? pz.cellPart : ''}`} aria-pressed={full} aria-label={full ? `Undo ${label}` : `${label}: ${n} of ${ceiling}. Add one`}
        onClick={() => onAdd(full ? -n : 1)}>{ceiling === 1 ? (full ? '✓' : '') : `${n}/${ceiling}`}</button>
      {ceiling > 1 && n > 0 && !full && <button type="button" disabled={disabled} className={pz.cellMinus} aria-label={`Take one off ${label}`} onClick={() => onAdd(-1)}><Minus size={11} aria-hidden="true" /></button>}
    </span>
  );
}

// ---- a prize on its own row (every grouping except Station) ----------------------------------------------------------------------------------------------------------------------
export function PrizeRowView({ row, ctx, stations, hasEvent, open, onToggle, flash }: { row: Row; ctx: PrizingCtx; stations: Station[]; hasEvent: boolean; open: boolean; onToggle: () => void; flash: boolean }) {
  const { p } = row;
  const free = stations.filter((s) => !row.lines.some((l) => l.station_id === s.id));
  return (
    <div id={`prize-${p.id}`} className={`${pz.row} ${flash || ctx.flashing(`prize:${p.id}`) ? pz.flash : ''} ${p.left < 0 ? pz.rowBad : ''}`}>
      <div className={pz.rowMain}>
        <button type="button" className={pz.name} onClick={onToggle} aria-expanded={open} disabled={!hasEvent}>
          {hasEvent ? (open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />) : null}<b>{p.name}</b>
        </button>
        <Tags p={p} sponsor={row.sponsor} />
      </div>
      <div className={pz.num} data-label="In stock"><NumberCell field value={p.quantity} canEdit={ctx.canStock} label={`How many ${p.name} are on hand`} onEdit={(on) => ctx.editing(on ? `prize:${p.id}` : null)} onSave={(v) => { if (v !== null && v !== p.quantity) ctx.setStock(p, v); }} />{ctx.heldBy(`prize:${p.id}`) && <small className={pz.editor}>{ctx.heldBy(`prize:${p.id}`)} is typing…</small>}{p.price !== null && <small className={pz.sub}>{money(p.price)} each</small>}</div>
      <div className={pz.num} data-label="Left"><span className={`${pz.chip} ${leftClass(p.left)}`}>{p.left}</span>{row.elsewhere > 0 && <small className={pz.sub}>{row.elsewhere} in other events</small>}</div>
      {hasEvent && <div className={pz.num} data-label="This event"><span>{row.here}</span>{row.here > 0 && p.price !== null && <small className={pz.sub}>{money(row.here * p.price)}</small>}</div>}
      <div className={pz.tools}>
        <RowMenu label={`More for ${p.name}`} items={[{ label: 'Edit Details', onClick: () => ctx.edit(p) }, { label: 'History', onClick: () => ctx.history(p) }]} />
      </div>
      {open && hasEvent && (
        <div className={pz.expand}>
          {p.used_at.length > 0 && <p className={pz.muted}>Used at: {p.used_at.join(', ')}</p>}
          {row.lines.length === 0 && <p className={pz.muted}>Not in any station of this event yet.</p>}
          {row.lines.map((l) => {
            const st = stations.find((s) => s.id === l.station_id);
            return (
              <div key={l.id} className={`${pz.expandLine} ${ctx.flashing(`line:${l.id}`) ? pz.flash : ''}`}>
                <span className={pz.expandName}>{st?.name ?? 'Station'}</span>
                <NumberCell field value={l.quantity} canEdit={ctx.manage && !(st && ctx.locked(st))} label={`How many ${p.name} for ${st?.name ?? 'the station'}`} onEdit={(on) => ctx.editing(on ? `line:${l.id}` : null)} onSave={(v) => { if (v !== null) ctx.setLine(l.station_id, p, v); }} />{ctx.heldBy(`line:${l.id}`) && <small className={pz.editor}>{ctx.heldBy(`line:${l.id}`)} is typing…</small>}
              </div>
            );
          })}
          {ctx.manage && free.length > 0 && (
            <div className={pz.expandAdd}>
              <Combo value={null} options={free.map((s) => s.name)} placeholder="Add to a station…" clearable={false} ariaLabel={`Add ${p.name} to a station`} onChange={(v) => { const s = free.find((x) => x.name === v); if (s) ctx.setLine(s.id, p, 1); }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- a station with its prizes (Group by Station) -----------------------------------------------------------------------------------------------------------------------------------
export interface StationLine { id: string; quantity: number; p: PrizeRow; sponsor: string | null }
export function StationBlock({ station, lines, ctx, addable, need, asked, onAdd, onFill, onEdit, onRemove, flash, summary, onAll, open, onToggle }: {
  station: Station; lines: StationLine[]; ctx: PrizingCtx; addable: PrizeRow[]; need: Record<string, number>; asked: number; onAdd: (p: PrizeRow) => void; onFill?: () => void; onEdit: () => void; onRemove: () => void; flash: boolean;
  summary: (stepId: string) => { done: number; total: number } | null; onAll?: (stepId: string) => void; open: boolean; onToggle: () => void;
}) {
  const total = lines.reduce((n, l) => n + l.quantity, 0);
  const lockedHere = ctx.locked(station);
  const canEdit = ctx.manage && !lockedHere;
  const short = needText(need, ctx.sizeOrder);
  return (
    <section id={`station-${station.id}`} className={`${pz.block} ${flash || ctx.flashing(`station:${station.id}`) ? pz.flash : ''}`} aria-label={station.name}>
      <header className={pz.blockHead}>
        <button type="button" className={pz.blockName} onClick={onToggle} aria-expanded={open}>{open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}<b>{station.name}</b></button>
        <span className={pz.blockMeta}>{total} {total === 1 ? 'prize' : 'prizes'} · {money(valueOf(lines.map((l) => ({ quantity: l.quantity, price: l.p.price })))) || '$0'}{station.room ? ` · ${station.room}` : ''}</span>
        {asked > 0 && (short ? <span className={`${pz.badge} ${pz.badgeWarn}`}><TriangleAlert size={12} aria-hidden="true" /> Needs {short}</span> : <span className={`${pz.badge} ${pz.badgeOk}`}>Has what it asked for ({asked})</span>)}
        {lockedHere && <span className={pz.badge}>Locked</span>}
        <span className={pz.blockEnd}>
          {ctx.shownSteps.map((s) => { const x = summary(s.id); return x && x.total > 0 ? <span key={s.id} className={`${pz.stepHead} ${x.done >= x.total ? pz.stepDone : ''}`}><span>{s.name}</span><small>{x.done}/{x.total}</small>{onAll && !ctx.closed && x.done < x.total && <button type="button" className={pz.allBtn} onClick={() => onAll(s.id)} aria-label={`Mark every ${s.name} in ${station.name}`} title={`Mark all ${x.total - x.done} left as ${s.name}`}>All</button>}</span> : null; })}
          {ctx.manage && <RowMenu label={`More for ${station.name}`} items={[onFill && { label: 'Suggest Prizes For What It Asked', onClick: onFill }, { label: 'Rename Station', onClick: onEdit }, { label: 'Remove Station', danger: true, onClick: onRemove }].filter(Boolean) as never} />}
        </span>
      </header>
      {open && (
        <>
          {lines.length === 0 && <p className={`${pz.muted} ${pz.pad}`}>No prizes yet.</p>}
          {lines.length > 0 && <div className={`${pz.line} ${pz.lineHead}`} style={{ '--steps': ctx.shownSteps.length } as CSSProperties} aria-hidden="true"><span>Prize</span><span>How many</span><span>Left</span>{ctx.shownSteps.map((s) => <span key={s.id}>{s.name}</span>)}<span /></div>}
          {lines.map((l) => {
            const given = ctx.givenOf(l.id);
            return (
              <div key={l.id} className={`${pz.line} ${ctx.flashing(`line:${l.id}`) ? pz.flash : ''}`} style={{ '--steps': ctx.shownSteps.length } as CSSProperties}>
                <div className={pz.rowMain}><b className={pz.lineName}>{l.p.name}</b><Tags p={l.p} sponsor={l.sponsor} /></div>
                <div className={pz.num} data-label="How many"><NumberCell field value={l.quantity} canEdit={canEdit} label={`How many ${l.p.name} for ${station.name}`} onEdit={(on) => ctx.editing(on ? `line:${l.id}` : null)} onSave={(v) => { if (v !== null) ctx.setLine(station.id, l.p, v); }} />{ctx.heldBy(`line:${l.id}`) && <small className={pz.editor}>{ctx.heldBy(`line:${l.id}`)} is typing…</small>}{l.p.price !== null && <small className={pz.sub}>{money(l.quantity * l.p.price)}</small>}</div>
                <div className={pz.num} data-label="Left"><span className={`${pz.chip} ${leftClass(l.p.left)}`}>{l.p.left}</span></div>
                {ctx.shownSteps.map((s) => (
                  <div key={s.id} className={pz.num} data-label={s.name}>
                    <StepCell n={Math.min(ctx.count(l.id, s.id), stepCeiling(s, l, given))} ceiling={stepCeiling(s, l, given)} label={`${l.p.name} · ${s.name}`} disabled={ctx.closed} onSet={(v) => ctx.setCount(l.id, s.id, v)} onAdd={(d) => ctx.addCount(l.id, s.id, d)} onEdit={(on) => ctx.editing(on ? `count:${l.id}:${s.id}` : null)} />
                  </div>
                ))}
                <div className={pz.tools}>{canEdit && <RowMenu label={`More for ${l.p.name}`} items={[{ label: 'Take It Off This Station', danger: true, onClick: () => ctx.setLine(station.id, l.p, 0) }, { label: 'History', onClick: () => ctx.history(l.p) }]} />}</div>
              </div>
            );
          })}
          {canEdit && (
            <div className={pz.blockAdd}>
              <Plus size={14} aria-hidden="true" />
              <Combo value={null} options={addable.map((p) => `${p.name}${p.size ? ` · ${p.size.replace(/ Prizing$/, '')}` : ''} (${p.left} left)`)} placeholder="Add a prize…" clearable={false} ariaLabel={`Add a prize to ${station.name}`}
                onChange={(v) => { const p = addable.find((x) => `${x.name}${x.size ? ` · ${x.size.replace(/ Prizing$/, '')}` : ''} (${x.left} left)` === v); if (p) onAdd(p); }} />
            </div>
          )}
        </>
      )}
    </section>
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
