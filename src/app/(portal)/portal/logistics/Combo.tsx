'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import styles from './logistics.module.css';

// The dropdown used all through Logistics, like a spreadsheet's: click it, pick a value, or type a new one and add it right there (it is saved to the list for everyone).
// `Combo` holds one value; `MultiCombo` holds several as chips. Typing filters the list; Enter picks the highlighted entry; Escape closes.

interface PickerProps {
  options: string[];
  onPick: (value: string) => void;
  onCreate?: (value: string) => Promise<string | null>;   // saves a new list value, returns the stored name (or null if it failed)
  placeholder?: string;
  initial?: string;                                        // what the box shows while closed
  disabled?: boolean;
  clearable?: boolean;
  ariaLabel?: string;
  compact?: boolean;
  keepOpen?: boolean;
  autoFocus?: boolean;
  onBlurClose?: () => void;
}

function Picker({ options, onPick, onCreate, placeholder, initial = '', disabled, clearable, ariaLabel, compact, autoFocus, onBlurClose }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [hi, setHi] = useState(0);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  const q = text.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => !q || o.toLowerCase().includes(q)).slice(0, 60), [options, q]);
  const exact = options.some((o) => o.toLowerCase() === q);
  const canAdd = !!onCreate && !!q && !exact;
  const rows: { kind: 'opt' | 'add' | 'clear'; value: string }[] = [
    ...(clearable && !q ? [{ kind: 'clear' as const, value: '' }] : []),
    ...shown.map((value) => ({ kind: 'opt' as const, value })),
    ...(canAdd ? [{ kind: 'add' as const, value: text.trim() }] : []),
  ];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) { setOpen(false); setText(''); onBlurClose?.(); } };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, onBlurClose]);

  async function choose(r: { kind: 'opt' | 'add' | 'clear'; value: string }) {
    if (r.kind === 'add') {
      setBusy(true);
      const made = await onCreate!(r.value);
      setBusy(false);
      if (made === null) return;
      onPick(made);
    } else onPick(r.value);
    setOpen(false); setText(''); setHi(0);
  }

  return (
    <div ref={wrap} className={`${styles.combo} ${compact ? styles.comboCompact : ''}`}>
      <input
        className={styles.comboInput}
        value={open ? text : initial}
        placeholder={open && initial ? initial : placeholder}
        disabled={disabled || busy}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        onFocus={() => { setOpen(true); setHi(0); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, rows.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); const r = rows[hi] ?? rows[0]; if (r) void choose(r); }
          else if (e.key === 'Escape') { setOpen(false); setText(''); onBlurClose?.(); }
        }}
      />
      {open && rows.length > 0 && (
        <ul id={listId} className={styles.comboList} role="listbox">
          {rows.map((r, i) => (
            <li key={`${r.kind}:${r.value}`} role="option" aria-selected={i === hi} className={`${styles.comboRow} ${i === hi ? styles.comboRowOn : ''} ${r.kind !== 'opt' ? styles.comboRowSpecial : ''}`}
              onPointerDown={(e) => { e.preventDefault(); void choose(r); }} onMouseEnter={() => setHi(i)}>
              {r.kind === 'add' ? <><Plus size={13} aria-hidden="true" /> Add “{r.value}”</> : r.kind === 'clear' ? 'Clear' : r.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Combo({ value, options, onChange, onCreate, placeholder = 'Choose…', disabled, clearable = true, ariaLabel, compact, autoFocus, onClose }: {
  value: string | null; options: string[]; onChange: (v: string | null) => void; onCreate?: (v: string) => Promise<string | null>;
  placeholder?: string; disabled?: boolean; clearable?: boolean; ariaLabel?: string; compact?: boolean; autoFocus?: boolean; onClose?: () => void;
}) {
  return <Picker options={options} initial={value ?? ''} onPick={(v) => { onChange(v || null); onClose?.(); }} onCreate={onCreate} placeholder={placeholder} disabled={disabled} clearable={clearable && !!value} ariaLabel={ariaLabel} compact={compact} autoFocus={autoFocus} onBlurClose={onClose} />;
}

export function MultiCombo({ values, options, onChange, onCreate, placeholder = 'Add…', disabled, ariaLabel, renderChip }: {
  values: string[]; options: string[]; onChange: (v: string[]) => void; onCreate?: (v: string) => Promise<string | null>;
  placeholder?: string; disabled?: boolean; ariaLabel?: string; renderChip?: (v: string) => string;
}) {
  const left = options.filter((o) => !values.some((v) => v.toLowerCase() === o.toLowerCase()));
  return (
    <div className={styles.multi}>
      {values.length > 0 && (
        <ul className={styles.chips}>
          {values.map((v) => (
            <li key={v} className={styles.chip}>{renderChip ? renderChip(v) : v}
              {!disabled && <button type="button" className={styles.chipX} aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><X size={12} aria-hidden="true" /></button>}
            </li>
          ))}
        </ul>
      )}
      {!disabled && <Picker options={left} onPick={(v) => v && onChange([...values, v])} onCreate={onCreate} placeholder={placeholder} ariaLabel={ariaLabel} />}
    </div>
  );
}
