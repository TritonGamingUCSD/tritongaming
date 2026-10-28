'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Columns3, Plus, Trash2, X } from 'lucide-react';
import { compareCells, matchesFilter, parseCell, type CellKind, type CellValue } from '@/lib/logistics/sheetMath';
import { showToast } from '@/lib/ui/toast';
import { recordEdit } from './undo';
import styles from './sheet.module.css';

// One spreadsheet for a list of things (every prize, every device): a table that scrolls both ways with its header, filter row and first column kept in view, where every cell is edited in place. Click a cell
// to select it, then: arrows or Tab move, Enter (or just typing) edits, Enter saves and goes down, Esc cancels, Delete clears, Space ticks a box, Ctrl+C / Ctrl+V copy and paste a cell, Ctrl+Z undoes an edit.
// Click a header to sort, type in the row under it to filter, "Columns" hides the ones you do not need (remembered on this device), the last row adds a new one, a row's chevron opens what belongs to it.
// No pop ups: a picture opens the picture dialog (the one way to choose a picture), everything else happens in the cells. For a laptop or a tablet; a phone is told to use the cards.

export interface SheetCol<T> {
  id: string; label: string; width: number; kind: CellKind;
  group?: string; align?: 'right'; title?: string;
  get: (r: T) => CellValue;
  display?: (r: T) => ReactNode;   // how the value shows when it is not being edited
  set?: (r: T, v: CellValue) => Promise<boolean | void> | boolean | void;   // false = it was refused (the sheet says nothing more: the caller already told the person why)
  editable?: (r: T) => boolean;
  options?: string[] | ((r: T) => string[]);   // a choice cell
  create?: (v: string) => Promise<boolean>;   // a choice cell may add a new choice by typing it
  nullable?: boolean; required?: boolean; defaultHidden?: boolean;
  photo?: (r: T) => void;   // a picture cell: pressing it opens the picture dialog
}
export interface SheetAdd { required: string[]; create: (draft: Record<string, CellValue>) => Promise<boolean>; label: string }

type Active = { row: number; col: number } | null;   // row === view.length is the add row
const keyOf = (id: string) => `tg-sheet-${id}`;

export default function Sheet<T>({ id, rows, rowKey, cols, canEdit, add, onDelete, deleteLabel, expand, noun, rowTone }: {
  id: string; rows: T[]; rowKey: (r: T) => string; cols: SheetCol<T>[]; canEdit: boolean; add?: SheetAdd; onDelete?: (r: T) => Promise<boolean | void>; deleteLabel?: (r: T) => string;
  expand?: (r: T) => ReactNode; noun: string; rowTone?: (r: T) => 'bad' | 'warn' | undefined;
}) {
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(cols.filter((c) => c.defaultHidden).map((c) => c.id)));
  const [active, setActive] = useState<Active>(null);
  type Edit = { draft: string; all?: boolean };   // `all`: it was opened on what the cell already holds, so the text starts selected (typing over it replaces it)
  const [editing, setEditingState] = useState<Edit | null>(null);
  const editRef = useRef<Edit | null>(null);   // the same, readable at once: a blur that follows Enter must not save a second time
  const setEditing = (v: Edit | null) => { editRef.current = v; setEditingState(v); };
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string>('');   // "rowKey:colId" of a cell the server refused
  const [confirming, setConfirming] = useState('');   // the row whose delete is waiting for a second click
  const [draftRow, setDraftRow] = useState<Record<string, CellValue>>({});
  const scroll = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(900);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;   // undo and redo save against the row as it is by then, not as it was when the edit was made

  useEffect(() => { try { const j = JSON.parse(localStorage.getItem(keyOf(id)) ?? 'null'); if (j && Array.isArray(j.hidden)) setHidden(new Set(j.hidden as string[])); } catch { /* nothing remembered */ } }, [id]);
  const setHiddenSaved = (next: Set<string>) => { setHidden(next); try { localStorage.setItem(keyOf(id), JSON.stringify({ hidden: [...next] })); } catch { /* not remembered */ } };
  useEffect(() => {
    const el = scroll.current; if (!el) return;
    const ro = new ResizeObserver(() => setVw(el.clientWidth)); ro.observe(el); setVw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const shown = useMemo(() => cols.filter((c) => !hidden.has(c.id)), [cols, hidden]);
  const view = useMemo(() => {
    let out = rows.filter((r) => shown.every((c) => matchesFilter(c.kind, c.get(r), filters[c.id] ?? '')));
    if (sort) { const c = cols.find((x) => x.id === sort.col); if (c) out = [...out].sort((a, b) => compareCells(c.get(a), c.get(b), sort.dir)); }
    return out;
  }, [rows, shown, filters, sort, cols]);
  const filtering = Object.values(filters).some((v) => v.trim());
  const addRow = !!add && canEdit;
  const total = view.length + (addRow ? 1 : 0);
  const gutter = 44;
  const tableW = gutter + shown.reduce((n, c) => n + c.width, 0) + (onDelete && canEdit ? 52 : 0);

  const editableCell = (r: T | null, c: SheetCol<T>) => canEdit && c.kind !== 'readonly' && !!c.set && (r === null || !c.editable || c.editable(r));
  const choices = (c: SheetCol<T>, r: T | null) => (typeof c.options === 'function' ? (r ? c.options(r) : []) : c.options ?? []);

  // ---- saving ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const commit = useCallback(async (r: T, c: SheetCol<T>, value: CellValue) => {
    const old = c.get(r);
    if (old === value || (old === null && value === '') || (old === '' && value === null)) return;
    const k = `${rowKey(r)}:${c.id}`;
    const ok = await c.set?.(r, value);
    if (ok === false) { setFlash(k); window.setTimeout(() => setFlash((f) => (f === k ? '' : f)), 1800); return; }
    const now = () => rowsRef.current.find((x) => rowKey(x) === rowKey(r)) ?? r;
    recordEdit(() => { void c.set?.(now(), old); }, () => { void c.set?.(now(), value); });
  }, [rowKey]);

  const startEdit = (initial?: string) => {
    if (!active) return;
    const c = shown[active.col];
    const r = active.row < view.length ? view[active.row] : null;
    if (!c || !editableCell(r, c) || c.kind === 'bool' || c.kind === 'photo') return;
    setEditing({ draft: initial ?? (r ? String(c.get(r) ?? '') : String(draftRow[c.id] ?? '')), all: initial === undefined });
  };
  // Saves what was typed (or pasted) into a cell: into the row, or into the add row's draft, which creates the row once its required cells are filled.
  const applyText = async (r: T | null, c: SheetCol<T>, text: string) => {
    const parsed = parseCell(c.kind, text, !!c.nullable || c.kind === 'text' || c.kind === 'select');
    if ('error' in parsed) { showToast(parsed.error); return; }
    if (r) { await commit(r, c, parsed.value); return; }
    if (!add) return;
    const next = { ...draftRow, [c.id]: parsed.value };
    setDraftRow(next);
    if (add.required.every((k2) => { const v = next[k2]; return v !== undefined && v !== null && v !== ''; })) { if (await add.create(next)) setDraftRow({}); }
  };
  const finishEdit = async (move: 'down' | 'right' | 'left' | 'none', save: boolean) => {
    const ed = editRef.current;
    if (!active || !ed) return;
    setEditing(null);
    const c = shown[active.col];
    const r = active.row < view.length ? view[active.row] : null;
    if (save && c) await applyText(r, c, ed.draft);
    setActive((a) => {
      if (!a) return a;
      if (move === 'down') return { row: Math.min(total - 1, a.row + 1), col: a.col };
      if (move === 'right') return { row: a.row, col: Math.min(shown.length - 1, a.col + 1) };
      if (move === 'left') return { row: a.row, col: Math.max(0, a.col - 1) };
      return a;
    });
    scroll.current?.focus({ preventScroll: true });
  };
  const toggleBool = async (r: T, c: SheetCol<T>) => { if (editableCell(r, c)) await commit(r, c, !c.get(r)); };

  // ---- the keyboard -----------------------------------------------------------------------------------------------------------------------------------------------------------------
  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (editing || !active) return;
    const mod = e.metaKey || e.ctrlKey;
    const r = active.row < view.length ? view[active.row] : null;
    const c = shown[active.col];
    const go = (dr: number, dc: number) => { e.preventDefault(); setActive({ row: Math.max(0, Math.min(total - 1, active.row + dr)), col: Math.max(0, Math.min(shown.length - 1, active.col + dc)) }); };
    if (mod) {
      if (e.key.toLowerCase() === 'c' && r && c) { void navigator.clipboard?.writeText(String(c.get(r) ?? '')); e.preventDefault(); }
      else if (e.key.toLowerCase() === 'v' && c && editableCell(r, c) && c.kind !== 'bool' && c.kind !== 'photo') {
        e.preventDefault();
        try { const t = (await navigator.clipboard.readText()).split('\n')[0].replace(/\r$/, ''); await applyText(r, c, t); } catch { showToast('The browser wouldn’t let the page paste. Type it instead.'); }
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': return go(1, 0);
      case 'ArrowUp': return go(-1, 0);
      case 'ArrowRight': return go(0, 1);
      case 'ArrowLeft': return go(0, -1);
      case 'Tab': return go(0, e.shiftKey ? -1 : 1);
      case 'Home': return go(0, -active.col);
      case 'End': return go(0, shown.length);
      case 'Escape': setActive(null); return;
      case 'Enter': case 'F2':
        e.preventDefault();
        if (r && c?.kind === 'bool') void toggleBool(r, c);
        else if (r && c?.kind === 'photo') c.photo?.(r);
        else startEdit();
        return;
      case ' ':
        if (r && c?.kind === 'bool') { e.preventDefault(); void toggleBool(r, c); }
        return;
      case 'Delete': case 'Backspace':
        if (r && c && editableCell(r, c) && c.kind !== 'bool' && c.kind !== 'photo' && (c.nullable || c.kind === 'text')) { e.preventDefault(); void commit(r, c, null); }
        return;
      default:
        if (e.key.length === 1 && !e.altKey) { e.preventDefault(); startEdit(e.key); }
    }
  };

  useEffect(() => {   // keep the active cell in view
    if (!active) return;
    scroll.current?.querySelector<HTMLElement>(`[data-cell="${active.row}:${active.col}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  useEffect(() => { if (active && active.row >= total) setActive({ row: Math.max(0, total - 1), col: active.col }); }, [total, active]);

  const groups = useMemo(() => {
    const out: { label: string; span: number }[] = [];
    for (const c of shown) { const label = c.group ?? ''; if (out.length && out[out.length - 1].label === label) out[out.length - 1].span++; else out.push({ label, span: 1 }); }
    return out;
  }, [shown]);
  const hasGroups = groups.some((g) => g.label);
  const clickSort = (c: SheetCol<T>) => setSort((s) => (s?.col !== c.id ? { col: c.id, dir: 1 } : s.dir === 1 ? { col: c.id, dir: -1 } : null));

  // ---- one cell ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const cell = (r: T | null, ri: number, c: SheetCol<T>, ci: number) => {
    const isActive = active?.row === ri && active.col === ci;
    const isEditing = isActive && !!editing;
    const value: CellValue = r ? c.get(r) : draftRow[c.id] ?? null;
    const can = editableCell(r, c);
    const k = r ? `${rowKey(r)}:${c.id}` : '';
    let body: ReactNode;
    if (isEditing) {
      body = c.kind === 'select'
        ? <Chooser selectAll={!!editing!.all} options={choices(c, r)} draft={editing!.draft} onDraft={(v) => setEditing({ draft: v })} nullable={!!c.nullable} canCreate={!!c.create} onPick={async (v) => { if (c.create && v && !choices(c, r).some((o) => o.toLowerCase() === v.toLowerCase())) { if (!(await c.create(v))) return finishEdit('none', false); } void finishEditWith(v); }} onCancel={() => void finishEdit('none', false)} />
        : <input className={styles.editor} autoFocus value={editing!.draft} type={c.kind === 'date' ? 'date' : 'text'} inputMode={c.kind === 'number' ? 'numeric' : c.kind === 'money' ? 'decimal' : undefined}
            onChange={(e) => setEditing({ draft: e.target.value })} onFocus={(e) => { const el = e.currentTarget; if (c.kind !== 'date') { if (editing!.all) el.select(); else { const n = el.value.length; el.setSelectionRange(n, n); } } }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void finishEdit('down', true); } else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); void finishEdit(e.shiftKey ? 'left' : 'right', true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); void finishEdit('none', false); } else e.stopPropagation(); }}
            onBlur={() => void finishEdit('none', true)} aria-label={c.label} />;
    } else if (c.kind === 'bool') {
      body = <input type="checkbox" className={styles.tick} checked={!!value} disabled={!r || !can} onChange={() => { if (r) void toggleBool(r, c); }} aria-label={c.label} />;
    } else if (c.kind === 'photo' && r) {
      body = <button type="button" className={styles.photoBtn} onClick={() => c.photo?.(r)} disabled={!can} aria-label={`${c.label}: ${can ? 'choose a picture' : 'view'}`}>{c.display ? c.display(r) : null}</button>;
    } else {
      body = <span className={styles.value} title={c.title}>{r ? (c.display ? c.display(r) : value === null || value === '' ? '' : c.kind === 'money' ? `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2 })}` : String(value)) : value === null ? '' : String(value)}</span>;
    }
    return (
      <td key={c.id} data-cell={`${ri}:${ci}`} className={`${styles.cell} ${ci === 0 ? styles.first : ''} ${isActive ? styles.active : ''} ${c.align === 'right' ? styles.right : ''} ${can ? styles.canEdit : styles.ro} ${flash === k && k ? styles.refused : ''}`}
        style={ci === 0 ? { left: gutter } : undefined} onMouseDown={() => { if (!isEditing) setActive({ row: ri, col: ci }); }} onDoubleClick={() => { setActive({ row: ri, col: ci }); if (can) setTimeout(() => startEdit(), 0); }}
        role="gridcell" aria-selected={isActive}>
        {body}
      </td>
    );
  };
  // A choice picked from the list is saved at once (the editing state is only a draft until then).
  const finishEditWith = async (v: string) => {
    if (!active) return;
    const c = shown[active.col]; const r = active.row < view.length ? view[active.row] : null;
    setEditing(null);
    await applyText(r, c, v);
    scroll.current?.focus({ preventScroll: true });
  };

  const colsOf = (r: T | null, ri: number) => shown.map((c, ci) => cell(r, ri, c, ci));

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <span className={styles.count}>{filtering ? `${view.length} of ${rows.length}` : rows.length} {rows.length === 1 ? noun : `${noun}s`}</span>
        {(filtering || sort) && <button type="button" className={styles.link} onClick={() => { setFilters({}); setSort(null); }}><X size={13} aria-hidden="true" /> Clear Filters And Sort</button>}
        <details className={styles.cols}>
          <summary><Columns3 size={15} aria-hidden="true" /> Columns</summary>
          <div className={styles.colList}>
            {cols.map((c) => <label key={c.id}><input type="checkbox" checked={!hidden.has(c.id)} onChange={() => { const n = new Set(hidden); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setHiddenSaved(n); }} /> {c.label}</label>)}
            <button type="button" className={styles.link} onClick={() => setHiddenSaved(new Set())}>Show All</button>
          </div>
        </details>
        <span className={styles.hintLine}>Click a cell, then type or press Enter to edit. Arrows and Tab move. Ctrl+Z undoes.</span>
      </div>
      <div ref={scroll} className={styles.scroll} tabIndex={0} onKeyDown={(e) => void onKeyDown(e)} role="grid" aria-label={`${noun} sheet`} aria-rowcount={total} style={{ '--vw': `${vw}px` } as React.CSSProperties}>
        <table className={styles.grid} style={{ width: tableW }}>
          <colgroup><col style={{ width: gutter }} />{shown.map((c) => <col key={c.id} style={{ width: c.width }} />)}{onDelete && canEdit && <col style={{ width: 52 }} />}</colgroup>
          <thead>
            {hasGroups && <tr className={styles.groupRow}><th className={styles.corner} />{groups.map((g, i) => <th key={i} colSpan={g.span} className={g.label ? styles.groupHead : ''}>{g.label}</th>)}{onDelete && canEdit && <th />}</tr>}
            <tr className={`${styles.headRow} ${hasGroups ? styles.afterGroup : ''}`}>
              <th className={styles.corner} />
              {shown.map((c, ci) => (
                <th key={c.id} className={`${ci === 0 ? styles.first : ''} ${c.align === 'right' ? styles.right : ''}`} style={ci === 0 ? { left: gutter } : undefined} aria-sort={sort?.col === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  <button type="button" onClick={() => clickSort(c)} title={c.title ?? `Sort by ${c.label}`}>{c.label}{c.required ? ' *' : ''}{sort?.col === c.id ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</button>
                </th>
              ))}
              {onDelete && canEdit && <th />}
            </tr>
            <tr className={`${styles.filterRow} ${hasGroups ? styles.afterGroup : ''}`}>
              <th className={styles.corner} />
              {shown.map((c, ci) => (
                <th key={c.id} className={ci === 0 ? styles.first : ''} style={ci === 0 ? { left: gutter } : undefined}>
                  {c.kind !== 'photo' && <input value={filters[c.id] ?? ''} placeholder="Filter" onChange={(e) => setFilters((f) => ({ ...f, [c.id]: e.target.value }))} aria-label={`Filter ${c.label}`} />}
                </th>
              ))}
              {onDelete && canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {view.map((r, ri) => {
              const k = rowKey(r), more = expand?.(r), isOpen = open.has(k), tone = rowTone?.(r);
              return (
                <Fragment key={k}>
                  <tr className={`${styles.row} ${tone ? styles[tone] : ''} ${active?.row === ri ? styles.activeRow : ''}`}>
                    <td className={styles.gutter}>{more !== null && more !== undefined ? <button type="button" className={styles.chev} aria-expanded={isOpen} aria-label={isOpen ? 'Hide the details' : 'Show the details'} onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button> : <span className={styles.num}>{ri + 1}</span>}</td>
                    {colsOf(r, ri)}
                    {onDelete && canEdit && (
                      <td className={styles.del}>
                        <button type="button" className={confirming === k ? styles.sure : styles.trash} aria-label={confirming === k ? `Click again to delete ${deleteLabel?.(r) ?? 'this row'}` : `Delete ${deleteLabel?.(r) ?? 'this row'}`}
                          onClick={() => { if (confirming === k) { setConfirming(''); void onDelete(r); } else { setConfirming(k); window.setTimeout(() => setConfirming((c) => (c === k ? '' : c)), 3500); } }}>
                          {confirming === k ? 'Delete?' : <Trash2 size={14} aria-hidden="true" />}
                        </button>
                      </td>
                    )}
                  </tr>
                  {isOpen && more && <tr className={styles.detailRow}><td colSpan={shown.length + 1 + (onDelete && canEdit ? 1 : 0)}><div className={styles.detail} style={{ width: Math.max(320, vw - 24) }}>{more}</div></td></tr>}
                </Fragment>
              );
            })}
            {addRow && (
              <tr className={`${styles.row} ${styles.addRow}`}>
                <td className={styles.gutter}><Plus size={14} aria-hidden="true" /></td>
                {shown.map((c, ci) => (ci === 0 && draftRow[c.id] === undefined && !(active?.row === view.length && active.col === 0 && editing) ? (
                  <td key={c.id} data-cell={`${view.length}:0`} className={`${styles.cell} ${styles.first} ${styles.canEdit} ${active?.row === view.length && active.col === 0 ? styles.active : ''}`} style={{ left: gutter }} onMouseDown={() => setActive({ row: view.length, col: 0 })} onDoubleClick={() => { setActive({ row: view.length, col: 0 }); setTimeout(() => startEdit(), 0); }} role="gridcell"><span className={styles.placeholder}>{add!.label}</span></td>
                ) : cell(null, view.length, c, ci)))}
                {onDelete && canEdit && <td />}
              </tr>
            )}
            {view.length === 0 && !addRow && <tr><td colSpan={shown.length + 1} className={styles.none}>{filtering ? 'Nothing matches the filters.' : `No ${noun}s yet.`}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The list a choice cell shows while it is being edited: type to narrow it, arrows and Enter to pick, a new word may be added where the column allows it. It floats above the sheet (fixed) so the scrolling table cannot clip it.
function Chooser({ options, draft, onDraft, onPick, onCancel, nullable, canCreate, selectAll }: { selectAll: boolean; options: string[]; draft: string; onDraft: (v: string) => void; onPick: (v: string) => void; onCancel: () => void; nullable: boolean; canCreate: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const [hi, setHi] = useState(0);
  const q = draft.trim().toLowerCase();
  const list = useMemo(() => options.filter((o) => !q || o.toLowerCase().includes(q)), [options, q]);
  const typedNew = canCreate && q && !options.some((o) => o.toLowerCase() === q);
  const items = [...(nullable ? [''] : []), ...list, ...(typedNew ? [draft.trim()] : [])];
  useEffect(() => { const r = input.current?.getBoundingClientRect(); if (r) setPos({ left: r.left, top: r.bottom, width: Math.max(r.width, 180), up: window.innerHeight - r.bottom < 220 }); }, []);
  useEffect(() => { const first = items.findIndex((o) => o !== ''); setHi(q && first >= 0 ? first : 0); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => { const close = () => onCancel(); window.addEventListener('resize', close); return () => window.removeEventListener('resize', close); }, [onCancel]);
  return (
    <>
      <input ref={input} className={styles.editor} autoFocus value={draft} onChange={(e) => onDraft(e.target.value)} onFocus={(e) => { if (selectAll) e.currentTarget.select(); }} aria-label="Choose" role="combobox" aria-expanded="true"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(items.length - 1, h + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const pick = items[hi]; if (pick !== undefined) onPick(pick); }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }} />
      {pos && createPortal(
        <ul className={styles.chooser} role="listbox" style={{ position: 'fixed', left: pos.left, width: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top + 34 } : { top: pos.top + 2 }) }}>
          {items.map((o, i) => <li key={`${o}-${i}`} role="option" aria-selected={i === hi} className={i === hi ? styles.hi : ''} onMouseDown={(e) => { e.preventDefault(); onPick(o); }}>{o === '' ? <i>None</i> : typedNew && i === items.length - 1 ? <>Add “{o}”</> : o}</li>)}
          {items.length === 0 && <li className={styles.noMatch}>No match</li>}
        </ul>, document.body)}
    </>
  );
}
