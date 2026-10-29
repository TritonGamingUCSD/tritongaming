'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { isMove, moveFrom } from './cellNav';
import { useListPlacement } from '@/components/ui/useListPlacement';
import list from '@/components/ui/Listbox.module.css';
import styles from './logistics.module.css';

// The dropdown used all through Logistics, like a spreadsheet's: click it, pick a value, or type a new one and add it right there (it is saved to the list for everyone).
// `Combo` holds one value; `MultiCombo` holds several as chips. Typing filters the list; Enter picks the highlighted entry; Escape closes.

interface PickerProps {
  options: string[];
  onPick: (value: string) => void;
  onCreate?: (value: string) => Promise<string | null>; // saves a new list value, returns the stored name (or null if it failed)
  placeholder?: string;
  initial?: string; // what the box shows while closed
  disabled?: boolean;
  clearable?: boolean;
  ariaLabel?: string;
  compact?: boolean;
  sheet?: boolean; // a cell in a table: Tab and Enter go to the next cell (see cellNav)
  keepOpen?: boolean;
  autoFocus?: boolean;
  onBlurClose?: () => void;
}

function Picker({ options, onPick, onCreate, placeholder, initial = '', disabled, clearable, ariaLabel, compact, autoFocus, onBlurClose, sheet }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [hi, setHi] = useState(0);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false); // typed or arrowed: only then does Enter or Tab in a table cell pick the highlighted entry
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => {
    if (autoFocus) setOpen(true);
  }, [autoFocus]); // a phone won't focus a box by itself, so a box opened to be edited shows its list at once

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
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setOpen(false);
        setText('');
        onBlurClose?.();
      }
    };
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
    setOpen(false);
    setText('');
    setHi(0);
  }

  return (
    <div ref={wrap} className={`${styles.combo} ${styles.comboHasChevron} ${compact ? styles.comboCompact : ''}`}>
      <input
        className={styles.comboInput}
        value={open ? text : initial}
        placeholder={open && initial ? initial : placeholder}
        disabled={disabled || busy}
        autoFocus={autoFocus}
        data-cell={sheet ? '' : undefined}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setHi(0);
        }}
        onClick={() => setOpen(true)} // a tap on a box that already has focus (a phone or tablet does not send focus again)
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHi(0);
          setTouched(true);
        }}
        onKeyDown={(e) => {
          if (sheet && isMove(e)) {
            // in a table cell: pick if something was chosen, then go to the next cell
            const r = touched ? (rows[hi] ?? rows[0]) : undefined;
            moveFrom(e.currentTarget, e);
            if (r) void choose(r);
            else {
              e.preventDefault();
              setOpen(false);
              setText('');
              onBlurClose?.();
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setTouched(true);
            setHi((h) => Math.min(h + 1, rows.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setTouched(true);
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const r = rows[hi] ?? rows[0];
            if (r) void choose(r);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setText('');
            onBlurClose?.();
          }
        }}
      />
      <ChevronDown size={16} className={styles.comboChevron} aria-hidden="true" />
      {open && rows.length > 0 && (
        <ul id={listId} className={list.list} role="listbox" style={pos ?? { visibility: 'hidden' }}>
          {rows.map((r, i) => (
            <li
              key={`${r.kind}:${r.value}`}
              role="option"
              aria-selected={i === hi}
              className={`${list.row} ${i === hi ? list.rowOn : ''} ${r.kind !== 'opt' ? list.rowSpecial : ''} ${r.kind === 'opt' && r.value === initial ? list.rowSel : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void choose(r)}
              onMouseEnter={() => setHi(i)}
            >
              {r.kind === 'add' ? (
                <>
                  <Plus size={13} aria-hidden="true" /> Add “{r.value}”
                </>
              ) : r.kind === 'clear' ? (
                'Clear'
              ) : (
                r.value
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Combo({
  value,
  options,
  onChange,
  onCreate,
  placeholder = 'Choose…',
  disabled,
  clearable = true,
  ariaLabel,
  compact,
  sheet,
  autoFocus,
  onClose,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  onCreate?: (v: string) => Promise<string | null>;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  ariaLabel?: string;
  compact?: boolean;
  sheet?: boolean;
  autoFocus?: boolean;
  onClose?: () => void;
}) {
  return (
    <Picker
      options={options}
      initial={value ?? ''}
      onPick={(v) => {
        onChange(v || null);
        onClose?.();
      }}
      onCreate={onCreate}
      placeholder={placeholder}
      disabled={disabled}
      clearable={clearable && !!value}
      ariaLabel={ariaLabel}
      compact={compact}
      sheet={sheet}
      autoFocus={autoFocus}
      onBlurClose={onClose}
    />
  );
}

export function MultiCombo({
  values,
  options,
  onChange,
  onCreate,
  placeholder = 'Add…',
  disabled,
  ariaLabel,
  renderChip,
}: {
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
  onCreate?: (v: string) => Promise<string | null>;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  renderChip?: (v: string) => string;
}) {
  const left = options.filter((o) => !values.some((v) => v.toLowerCase() === o.toLowerCase()));
  return (
    <div className={styles.multi}>
      {values.length > 0 && (
        <ul className={styles.chips}>
          {values.map((v) => (
            <li key={v} className={styles.chip}>
              {renderChip ? renderChip(v) : v}
              {!disabled && (
                <button type="button" className={styles.chipX} aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && <Picker options={left} onPick={(v) => v && onChange([...values, v])} onCreate={onCreate} placeholder={placeholder} ariaLabel={ariaLabel} />}
    </div>
  );
}

/** A text box that suggests values as you type, in the same list as the drop-downs (instead of the browser's own suggestion list). What is typed stays free text; picking a suggestion fills it in. Enter is left to the caller unless an arrow key highlighted a suggestion. */
export function Suggest({
  value,
  onChange,
  options,
  inputRef,
  onKeyDown,
  onFocus,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; hint?: string }[];
  inputRef?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'>) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const own = useRef<HTMLInputElement | null>(null);
  const listEl = useRef<HTMLUListElement>(null);
  const listId = useId();
  const q = value.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => !q || o.value.toLowerCase().includes(q)).slice(0, 60), [options, q]);
  const visible = open && shown.length > 0 && !(shown.length === 1 && shown[0].value.toLowerCase() === q);
  const pos = useListPlacement(visible, own, shown.length);
  useEffect(() => {
    if (!visible) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!own.current?.contains(t) && !listEl.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [visible]);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setHi(-1);
  };
  return (
    <>
      <input
        {...rest}
        ref={(el) => {
          own.current = el;
          if (typeof inputRef === 'function') inputRef(el);
          else if (inputRef) (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
        }}
        value={value}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHi(-1);
        }}
        onFocus={(e) => {
          setOpen(true);
          onFocus?.(e);
        }}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (visible && e.key === 'ArrowDown') {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, shown.length - 1));
          } else if (visible && e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, -1));
          } else if (visible && e.key === 'Enter' && hi >= 0) {
            e.preventDefault();
            pick(shown[hi].value);
          } else if (e.key === 'Escape') setOpen(false);
          else onKeyDown?.(e);
        }}
      />
      {visible && (
        <ul ref={listEl} id={listId} className={list.list} role="listbox" style={pos ?? { visibility: 'hidden' }}>
          {shown.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === hi}
              className={`${list.row} ${i === hi ? list.rowOn : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
              onMouseEnter={() => setHi(i)}
            >
              <span>{o.value}</span>
              {o.hint && <span className={list.hint}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
