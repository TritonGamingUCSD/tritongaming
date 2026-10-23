'use client';

import { useState } from 'react';
import { Combo, MultiCombo } from './Combo';
import { isMove, moveFrom, tapTwice } from './cellNav';
import styles from './logistics.module.css';

// Shows what was just saved until the screen gets the saved value back (or a few seconds pass, if the save failed), so the old text never flashes back after a save.
function useHeld<T>(value: T) {
  const [held, setHeld] = useState<{ v: T; base: string } | null>(null);
  const key = JSON.stringify(value);
  const shown = held && held.base === key ? held.v : value;
  const hold = (v: T) => { setHeld({ v, base: key }); setTimeout(() => setHeld((h) => (h && h.v === v ? null : h)), 6000); };
  return [shown, hold] as const;
}

// A spreadsheet-style cell: click to change, and it saves when you pick or press Enter. Officers who can't edit just see the value.
export function TextCell({ value, canEdit, onSave, placeholder, strong }: { value: string | null; canEdit: boolean; onSave: (v: string) => void; placeholder?: string; strong?: boolean }) {
  const [on, setOn] = useState(false);
  const [text, setText] = useState(value ?? '');
  const [shown, hold] = useHeld(value);
  const open = () => { setText(shown ?? ''); setOn(true); };
  if (!canEdit) return <span className={strong ? styles.strong : undefined}>{shown || <span className={styles.dim}>{placeholder ?? '–'}</span>}</span>;
  if (!on) return <button type="button" data-cell className={`${styles.editCell} ${strong ? styles.strong : ''}`} onClick={(e) => tapTwice(e, open)}>{shown || <span className={styles.editHint}>{placeholder ?? 'Add'}</span>}</button>;
  const done = (save: boolean) => { setOn(false); if (save && text.trim() !== (shown ?? '')) { hold(text.trim() || null); onSave(text.trim()); } };
  return <input data-cell className={styles.cellInput} value={text} autoFocus onFocus={(e) => e.target.select()} maxLength={120} onChange={(e) => setText(e.target.value)} onBlur={() => done(true)} onKeyDown={(e) => { if (isMove(e)) { moveFrom(e.currentTarget, e); done(true); } else if (e.key === 'Escape') done(false); }} />;
}

export function PickCell({ value, options, canEdit, onSave, onCreate, shown, clearable = true, locate, placeholder }: { placeholder?: string; locate?: boolean; value: string | null; options: string[]; canEdit: boolean; onSave: (v: string | null) => void; onCreate?: (v: string) => Promise<string | null>; shown?: string; clearable?: boolean }) {
  const [on, setOn] = useState(false);
  const [held, hold] = useHeld<string | null>(value);
  const label = held !== value ? held : shown ?? value;
  const open = () => setOn(true);
  const none = locate ? <span className={styles.notLocated}>Not located</span> : null;
  if (!canEdit) return <span>{label ?? none ?? <span className={styles.dim}>–</span>}</span>;
  if (!on) return <button type="button" data-cell className={styles.editCell} onClick={(e) => tapTwice(e, open)}>{label ?? none ?? <span className={styles.editHint}>{placeholder ?? 'Choose'}</span>}</button>;
  return <Combo value={label ?? null} options={options} onChange={(v) => { if (v !== null) hold(v); onSave(v); }} onCreate={onCreate} compact sheet autoFocus clearable={clearable} onClose={() => setOn(false)} />;
}


// A number that is plain text until you click it (like the other cells), then a box; saved when you leave it. Empty clears it when `nullable`.
export function NumberCell({ value, canEdit, onSave, label, step = 1, money, nullable }: { value: number | null; canEdit: boolean; onSave: (v: number | null) => void; label: string; step?: number; money?: boolean; nullable?: boolean }) {
  const [on, setOn] = useState(false);
  const [text, setText] = useState('');
  const [num, hold] = useHeld(value);
  const open = () => { setText(num === null ? '' : String(num)); setOn(true); };
  const shown = num === null ? null : `${money ? '$' : ''}${money && !Number.isInteger(num) ? num.toFixed(2) : num}`;
  if (!canEdit) return <span>{shown ?? <span className={styles.dim}>–</span>}</span>;
  if (!on) return <button type="button" data-cell className={styles.editCell} aria-label={`${label}. Change`} onClick={(e) => tapTwice(e, open)}>{shown ?? <span className={styles.editHint}>Add</span>}</button>;
  const done = (save: boolean) => {
    setOn(false);
    if (!save) return;
    const n = text.trim() === '' ? null : Number(text);
    if (n === null ? nullable && num !== null : Number.isFinite(n) && n !== num) { hold(n); onSave(n); }
  };
  return <input data-cell className={`${styles.cellInput} ${styles.cellNum}`} type="number" inputMode={money ? 'decimal' : 'numeric'} min={0} step={step} value={text} autoFocus aria-label={label} onFocus={(e) => e.target.select()}
    onChange={(e) => setText(e.target.value)} onBlur={() => done(true)} onKeyDown={(e) => { if (isMove(e)) { moveFrom(e.currentTarget, e); done(true); } else if (e.key === 'Escape') done(false); }} />;
}

// A list of values (installed games): plain text until clicked, then the chips box; closes when you click away.
export function ListCell({ values, options, canEdit, onSave, label, placeholder = 'Add' }: { values: string[]; options: string[]; canEdit: boolean; onSave: (v: string[]) => void; label: string; placeholder?: string }) {
  const [on, setOn] = useState(false);
  const [shownValues, hold] = useHeld(values);
  const open = () => setOn(true);
  if (!on) {
    const text = shownValues.join(', ');
    return canEdit
      ? <button type="button" data-cell className={styles.editCell} aria-label={`${label}. Change`} onClick={(e) => tapTwice(e, open)}>{text || <span className={styles.editHint}>{placeholder}</span>}</button>
      : <span>{text || <span className={styles.dim}>–</span>}</span>;
  }
  return (
    <span className={styles.listCellEdit} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOn(false); }}>
      <MultiCombo values={values} options={options} onChange={(v) => { hold(v); onSave(v); }} ariaLabel={label} placeholder={placeholder} />
      <button type="button" className={styles.linkBtn} onClick={() => setOn(false)}>Done</button>
    </span>
  );
}

export { Combo };
