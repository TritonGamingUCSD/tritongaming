'use client';

import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

// The one dropdown. A drop-in for a native <select> (same <option>/<optgroup> children, same
// value/onChange(e.target.value) contract) but drawn by us, so it looks and behaves the same on every
// browser and platform. Native selects hand the open list to the OS, which is how Windows ended up
// with white text on a white list. This one is a real listbox: keyboard (arrows, Home/End, type to
// jump, Enter/Space, Esc), screen-reader roles, and it flips upward near the bottom of the screen.
interface Opt { value: string; label: ReactNode; text: string; disabled: boolean; group?: string }

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

function collect(children: ReactNode, group?: string): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; disabled?: boolean; label?: string; children?: ReactNode }>;
    if (el.type === 'optgroup') { out.push(...collect(el.props.children, el.props.label)); return; }
    if (el.type === 'option') {
      const text = textOf(el.props.children);
      out.push({ value: el.props.value !== undefined ? String(el.props.value) : text, label: el.props.children, text, disabled: !!el.props.disabled, group });
    }
  });
  return out;
}

interface Props {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  title?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  autoFocus?: boolean;
}

export default function Select({ value, defaultValue, onChange, children, className = '', style, disabled, required, name, id, title, autoFocus, ...aria }: Props) {
  const options = useMemo(() => collect(children), [children]);
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const current = value !== undefined ? String(value) : inner;
  const selected = options.find((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 200 && above > below;
    const maxHeight = Math.max(140, Math.min(300, up ? above : below));
    const width = Math.max(r.width, 180);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos(up ? { left, width, bottom: window.innerHeight - r.top + 4, maxHeight } : { left, width, top: r.bottom + 4, maxHeight });
  }, []);

  function commit(v: string) {
    if (value === undefined) setInner(v);
    onChange?.({ target: { value: v, name: name ?? '' }, currentTarget: { value: v, name: name ?? '' } } as unknown as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    trigger.current?.focus();
  }

  function openList() {
    if (disabled) return;
    const i = Math.max(0, options.findIndex((o) => o.value === current));
    setActive(i);
    place();
    setOpen(true);
  }

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (list.current?.contains(t) || trigger.current?.contains(t)) return;
      setOpen(false);
    };
    const reposition = (e: Event) => { if (!list.current?.contains(e.target as Node)) place(); };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', place);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', place); };
  }, [open, place]);

  // Keep the highlighted option in view as the keyboard moves it.
  useEffect(() => {
    if (!open) return;
    (list.current?.querySelector(`[data-index="${active}"]`) as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i;
    return from;
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => step(a, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => step(a, -1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(step(-1, 1)); }
    else if (e.key === 'End') { e.preventDefault(); setActive(step(options.length, -1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const o = options[active]; if (o && !o.disabled) commit(o.value); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Type to jump to the next option starting with what was typed.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at > 700 ? '' : typed.current.text) + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o, i) => i >= 0 && !o.disabled && o.text.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  const empty = !selected || selected.value === '';
  return (
    <>
      <button
        ref={trigger}
        type="button"
        id={id}
        title={title}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        {...aria}
        autoFocus={autoFocus}
        disabled={disabled}
        className={`${styles.trigger} ${className}`}
        style={style}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={`${styles.value} ${empty ? styles.placeholder : ''}`}>{selected ? selected.label : ' '}</span>
        <ChevronDown size={15} strokeWidth={2} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true" />
      </button>
      {(required || name) && (
        <input className={styles.hidden} tabIndex={-1} aria-hidden="true" name={name} value={current} required={required} onChange={() => {}} onFocus={() => trigger.current?.focus()} />
      )}
      {open && pos && createPortal(
        <div
          ref={list}
          id={listId}
          role="listbox"
          className={styles.list}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o, i) => (
            <div key={`${o.value}-${i}`}>
              {o.group && options[i - 1]?.group !== o.group && <div className={styles.group}>{o.group}</div>}
              <div
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === current}
                aria-disabled={o.disabled || undefined}
                className={`${styles.option} ${i === active ? styles.active : ''} ${o.value === current ? styles.selected : ''} ${o.disabled ? styles.disabled : ''}`}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={() => !o.disabled && commit(o.value)}
              >
                <span className={styles.optionText}>{o.label}</span>
                {o.value === current && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
