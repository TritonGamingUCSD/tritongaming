'use client';

import { useState } from 'react';
import { Combo, MultiCombo } from './Combo';
import styles from './logistics.module.css';

// A spreadsheet-style cell: click to change, and it saves when you pick or press Enter. Officers who can't edit just see the value.
export function TextCell({ value, canEdit, onSave, placeholder, strong }: { value: string | null; canEdit: boolean; onSave: (v: string) => void; placeholder?: string; strong?: boolean }) {
  const [on, setOn] = useState(false);
  const [text, setText] = useState(value ?? '');
  if (!canEdit) return <span className={strong ? styles.strong : undefined}>{value ?? <span className={styles.dim}>{placeholder ?? '—'}</span>}</span>;
  if (!on) return <button type="button" className={`${styles.editCell} ${strong ? styles.strong : ''}`} onClick={() => { setText(value ?? ''); setOn(true); }}>{value ?? <span className={styles.dim}>{placeholder ?? 'Add'}</span>}</button>;
  const done = (save: boolean) => { setOn(false); if (save && text.trim() !== (value ?? '')) onSave(text.trim()); };
  return <input className={styles.cellInput} value={text} autoFocus onFocus={(e) => e.target.select()} maxLength={120} onChange={(e) => setText(e.target.value)} onBlur={() => done(true)} onKeyDown={(e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); }} />;
}

export function PickCell({ value, options, canEdit, onSave, onCreate, shown, clearable = true, locate }: { locate?: boolean; value: string | null; options: string[]; canEdit: boolean; onSave: (v: string | null) => void; onCreate?: (v: string) => Promise<string | null>; shown?: string; clearable?: boolean }) {
  const [on, setOn] = useState(false);
  const label = shown ?? value;
  const none = locate ? <span className={styles.notLocated}>Not located</span> : null;
  if (!canEdit) return <span>{label ?? none ?? <span className={styles.dim}>—</span>}</span>;
  if (!on) return <button type="button" className={styles.editCell} onClick={() => setOn(true)}>{label ?? none ?? <span className={styles.dim}>Choose</span>}</button>;
  return <Combo value={label ?? null} options={options} onChange={onSave} onCreate={onCreate} compact autoFocus clearable={clearable} onClose={() => setOn(false)} />;
}


// A number that is plain text until you click it (like the other cells), then a box; saved when you leave it. Empty clears it when `nullable`.
export function NumberCell({ value, canEdit, onSave, label, step = 1, money, nullable }: { value: number | null; canEdit: boolean; onSave: (v: number | null) => void; label: string; step?: number; money?: boolean; nullable?: boolean }) {
  const [on, setOn] = useState(false);
  const [text, setText] = useState('');
  const shown = value === null ? null : `${money ? '$' : ''}${money && !Number.isInteger(value) ? value.toFixed(2) : value}`;
  if (!canEdit) return <span>{shown ?? <span className={styles.dim}>–</span>}</span>;
  if (!on) return <button type="button" className={styles.editCell} aria-label={`${label}. Change`} onClick={() => { setText(value === null ? '' : String(value)); setOn(true); }}>{shown ?? <span className={styles.dim}>Add</span>}</button>;
  const done = (save: boolean) => {
    setOn(false);
    if (!save) return;
    const n = text.trim() === '' ? null : Number(text);
    if (n === null ? nullable && value !== null : Number.isFinite(n) && n !== value) onSave(n);
  };
  return <input className={`${styles.cellInput} ${styles.cellNum}`} type="number" inputMode={money ? 'decimal' : 'numeric'} min={0} step={step} value={text} autoFocus aria-label={label} onFocus={(e) => e.target.select()}
    onChange={(e) => setText(e.target.value)} onBlur={() => done(true)} onKeyDown={(e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); }} />;
}

// A list of values (installed games): plain text until clicked, then the chips box; closes when you click away.
export function ListCell({ values, options, canEdit, onSave, label, placeholder = 'Add' }: { values: string[]; options: string[]; canEdit: boolean; onSave: (v: string[]) => void; label: string; placeholder?: string }) {
  const [on, setOn] = useState(false);
  if (!on) {
    const text = values.join(', ');
    return canEdit
      ? <button type="button" className={styles.editCell} aria-label={`${label}. Change`} onClick={() => setOn(true)}>{text || <span className={styles.dim}>{placeholder}</span>}</button>
      : <span>{text || <span className={styles.dim}>–</span>}</span>;
  }
  return (
    <span className={styles.listCellEdit} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOn(false); }}>
      <MultiCombo values={values} options={options} onChange={onSave} ariaLabel={label} placeholder={placeholder} />
      <button type="button" className={styles.linkBtn} onClick={() => setOn(false)}>Done</button>
    </span>
  );
}

export { Combo };
