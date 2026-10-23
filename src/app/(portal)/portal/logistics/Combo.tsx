'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
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

// The list is placed on the screen (fixed) so a table that scrolls or clips its cells can't hide it, and it opens upwards when there is no room below.
function useListPlacement(open: boolean, anchor: React.RefObject<HTMLElement | null>, dep: number): React.CSSProperties | null {
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      // On an iPhone the keyboard covers the page without shrinking the window, so room is measured against what is actually visible (the visual viewport).
      const vv = window.visualViewport, top = vv?.offsetTop ?? 0, seen = top + (vv?.height ?? window.innerHeight);
      const below = seen - r.bottom - 8, above = r.top - top - 8;
      const up = below < 200 && above > below;
      const room = Math.max(120, Math.min(240, up ? above : below));
      setPos({ position: 'fixed', left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 176) - 8)), width: Math.max(r.width, 176), maxHeight: room, right: 'auto', ...(up ? { bottom: window.innerHeight - r.top + 3, top: 'auto' } : { top: r.bottom + 3 }) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place); };
  }, [open, dep, anchor]);
  return pos;
}

function Picker({ options, onPick, onCreate, placeholder, initial = '', disabled, clearable, ariaLabel, compact, autoFocus, onBlurClose }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [hi, setHi] = useState(0);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => { if (autoFocus) setOpen(true); }, [autoFocus]);   // a phone won't focus a box by itself, so a box opened to be edited shows its list at once

  const q = text.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => !q || o.toLowerCase().includes(q)).slice(0, 60), [options, q]);
  const exact = options.some((o) => o.toLowerCase() === q);
  const canAdd = !!onCreate && !!q && !exact;
  const rows: { kind: 'opt' | 'add' | 'clear'; value: string }[] = [
    ...(clearable && !q ? [{ kind: 'clear' as const, value: '' }] : []),
    ...shown.map((value) => ({ kind: 'opt' as const, value })),
    ...(canAdd ? [{ kind: 'add' as const, value: text.trim() }] : []),
  ];

  const pos = useListPlacement(open, wrap, rows.length);

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
    <div ref={wrap} className={`${styles.combo} ${styles.comboHasChevron} ${compact ? styles.comboCompact : ''}`}>
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
        onClick={() => setOpen(true)}   // a tap on a box that already has focus (a phone or tablet does not send focus again)
        onChange={(e) => { setText(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, rows.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); const r = rows[hi] ?? rows[0]; if (r) void choose(r); }
          else if (e.key === 'Escape') { setOpen(false); setText(''); onBlurClose?.(); }
        }}
      />
      <ChevronDown size={16} className={styles.comboChevron} aria-hidden="true" />
      {open && rows.length > 0 && (
        <ul id={listId} className={styles.comboList} role="listbox" style={pos ?? { visibility: 'hidden' }}>
          {rows.map((r, i) => (
            <li key={`${r.kind}:${r.value}`} role="option" aria-selected={i === hi} className={`${styles.comboRow} ${i === hi ? styles.comboRowOn : ''} ${r.kind !== 'opt' ? styles.comboRowSpecial : ''} ${r.kind === 'opt' && r.value === initial ? styles.comboRowSel : ''}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => void choose(r)} onMouseEnter={() => setHi(i)}>
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

/** A text box that suggests values as you type, in the same list as the drop-downs (instead of the browser's own suggestion list). What is typed stays free text; picking a suggestion fills it in. Enter is left to the caller unless an arrow key highlighted a suggestion. */
export function Suggest({ value, onChange, options, inputRef, onKeyDown, onFocus, ...rest }: {
  value: string; onChange: (v: string) => void; options: { value: string; hint?: string }[]; inputRef?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'>) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const own = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const q = value.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => !q || o.value.toLowerCase().includes(q)).slice(0, 60), [options, q]);
  const visible = open && shown.length > 0 && !(shown.length === 1 && shown[0].value.toLowerCase() === q);
  const pos = useListPlacement(visible, own, shown.length);
  useEffect(() => {
    if (!visible) return;
    const away = (e: PointerEvent) => { const t = e.target as Node; if (!own.current?.contains(t) && !list.current?.contains(t)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [visible]);
  const pick = (v: string) => { onChange(v); setOpen(false); setHi(-1); };
  return (
    <>
      <input
        {...rest} ref={(el) => { own.current = el; if (typeof inputRef === 'function') inputRef(el); else if (inputRef) (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el; }}
        value={value} role="combobox" aria-expanded={visible} aria-controls={listId} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={(e) => { setOpen(true); onFocus?.(e); }}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (visible && e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, shown.length - 1)); }
          else if (visible && e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, -1)); }
          else if (visible && e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(shown[hi].value); }
          else if (e.key === 'Escape') setOpen(false);
          else onKeyDown?.(e);
        }}
      />
      {visible && (
        <ul ref={list} id={listId} className={styles.comboList} role="listbox" style={pos ?? { visibility: 'hidden' }}>
          {shown.map((o, i) => (
            <li key={o.value} role="option" aria-selected={i === hi} className={`${styles.comboRow} ${i === hi ? styles.comboRowOn : ''}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.value)} onMouseEnter={() => setHi(i)}>
              <span>{o.value}</span>{o.hint && <span className={styles.comboHint}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
