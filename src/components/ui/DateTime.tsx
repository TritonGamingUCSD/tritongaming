'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import Popover from './Popover';
import styles from './DateTime.module.css';

// Date, time and date+time pickers drawn by us, so they look and behave the same on every browser and
// phone (native date/time inputs differ wildly between Chrome, Safari, Firefox, Windows and iOS).
// Values use the same strings as the native inputs — 'YYYY-MM-DD', 'HH:mm', 'YYYY-MM-DDTHH:mm' — and
// onChange(e) gets e.target.value, so they drop in where <input type="date|time|datetime-local"> was.
// They work on plain wall-clock values: no time zone is applied here.

type Change = (e: ChangeEvent<HTMLInputElement>) => void;
const emit = (onChange: Change | undefined, value: string) => onChange?.({ target: { value }, currentTarget: { value } } as unknown as ChangeEvent<HTMLInputElement>);

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const parseDate = (v: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; };
const parseTime = (v: string) => { const m = /(\d{2}):(\d{2})$/.exec(v); return m ? { h: +m[1], min: +m[2] } : null; };
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayKey = () => { const n = new Date(); return keyOf(n.getFullYear(), n.getMonth(), n.getDate()); };
const fmtDate = (v: string) => { const p = parseDate(v); return p ? new Date(p.y, p.m, p.d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''; };
const fmtTime = (v: string) => { const t = parseTime(v); if (!t) return ''; return `${((t.h + 11) % 12) + 1}:${pad(t.min)} ${t.h < 12 ? 'AM' : 'PM'}`; };

function Calendar({ value, min, max, onPick }: { value: string; min?: string; max?: string; onPick: (key: string) => void }) {
  const sel = parseDate(value);
  const base = sel ?? parseDate(todayKey())!;
  const [view, setView] = useState({ y: base.y, m: base.m });
  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const go = (delta: number) => setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const today = todayKey();
  return (
    <div className={styles.cal}>
      <div className={styles.calHead}>
        <button type="button" className={styles.nav} onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft size={16} aria-hidden="true" /></button>
        <strong>{MONTHS[view.m]} {view.y}</strong>
        <button type="button" className={styles.nav} onClick={() => go(1)} aria-label="Next month"><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
      <div className={styles.grid} role="grid">
        {DOW.map((d) => <span key={d} className={styles.dow}>{d}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const k = keyOf(view.y, view.m, d);
          const off = (!!min && k < min) || (!!max && k > max);
          return (
            <button key={k} type="button" disabled={off} onClick={() => onPick(k)}
              className={`${styles.day} ${k === value ? styles.daySel : ''} ${k === today ? styles.dayToday : ''}`} aria-pressed={k === value} aria-label={fmtDate(k)}>{d}</button>
          );
        })}
      </div>
      <div className={styles.calFoot}>
        <button type="button" className={styles.link} onClick={() => onPick(today)} disabled={(!!min && today < min) || (!!max && today > max)}>Today</button>
      </div>
    </div>
  );
}

function TimeColumns({ value, onPick }: { value: string; onPick: (hhmm: string) => void }) {
  const t = parseTime(value) ?? { h: 17, min: 0 };
  const h12 = ((t.h + 11) % 12) + 1;
  const pm = t.h >= 12;
  const minutes = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), t.min])].sort((a, b) => a - b);
  const set = (h: number, min: number, isPm: boolean) => onPick(`${pad((h % 12) + (isPm ? 12 : 0))}:${pad(min)}`);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelectorAll('[data-on="1"]').forEach((el) => (el as HTMLElement).scrollIntoView({ block: 'center' })); }, []);
  return (
    <div className={styles.cols} ref={ref}>
      <div className={styles.col} role="listbox" aria-label="Hour">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <button key={h} type="button" role="option" aria-selected={h === h12} data-on={h === h12 ? 1 : 0} className={`${styles.cell} ${h === h12 ? styles.cellOn : ''}`} onClick={() => set(h, t.min, pm)}>{h}</button>)}
      </div>
      <div className={styles.col} role="listbox" aria-label="Minute">
        {minutes.map((m) => <button key={m} type="button" role="option" aria-selected={m === t.min} data-on={m === t.min ? 1 : 0} className={`${styles.cell} ${m === t.min ? styles.cellOn : ''}`} onClick={() => set(h12, m, pm)}>{pad(m)}</button>)}
      </div>
      <div className={styles.col} role="listbox" aria-label="AM or PM">
        {['AM', 'PM'].map((p) => <button key={p} type="button" role="option" aria-selected={(p === 'PM') === pm} className={`${styles.cell} ${(p === 'PM') === pm ? styles.cellOn : ''}`} onClick={() => set(h12, t.min, p === 'PM')}>{p}</button>)}
      </div>
    </div>
  );
}

interface Common { value: string; onChange?: Change; className?: string; disabled?: boolean; required?: boolean; id?: string; placeholder?: string; name?: string; 'aria-label'?: string }

function Trigger({ children, icon, text, placeholder, className = '', disabled, required, name, value, open, onToggle, tref, ...aria }:
  { children?: never; icon: React.ReactNode; text: string; placeholder: string; className?: string; disabled?: boolean; required?: boolean; name?: string; value: string; open: boolean; onToggle: () => void; tref: React.RefObject<HTMLButtonElement | null>; id?: string; 'aria-label'?: string }) {
  return (
    <>
      <button ref={tref} type="button" className={`${styles.trigger} ${className}`} onClick={onToggle} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} {...aria}>
        <span className={`${styles.text} ${text ? '' : styles.placeholder}`}>{text || placeholder}</span>{icon}
      </button>
      {(required || name) && <input className={styles.hidden} tabIndex={-1} aria-hidden="true" name={name} value={value} required={required} onChange={() => {}} onFocus={() => tref.current?.focus()} />}
    </>
  );
}

export function DateInput({ value, onChange, min, max, placeholder = 'Pick a date', ...rest }: Common & { min?: string; max?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Trigger tref={ref} icon={<CalendarDays size={15} className={styles.icon} aria-hidden="true" />} text={fmtDate(value)} placeholder={placeholder} value={value} open={open} onToggle={() => setOpen((o) => !o)} {...rest} />
      {open && <Popover anchor={ref} onClose={() => setOpen(false)} width={288} label="Choose a date"><Calendar value={value} min={min} max={max} onPick={(k) => { emit(onChange, k); setOpen(false); }} /></Popover>}
    </>
  );
}

export function TimeInput({ value, onChange, placeholder = 'Pick a time', ...rest }: Common) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Trigger tref={ref} icon={<Clock size={15} className={styles.icon} aria-hidden="true" />} text={fmtTime(value)} placeholder={placeholder} value={value} open={open} onToggle={() => setOpen((o) => !o)} {...rest} />
      {open && <Popover anchor={ref} onClose={() => setOpen(false)} width={240} label="Choose a time"><TimeColumns value={value} onPick={(hhmm) => emit(onChange, hhmm)} /><div className={styles.calFoot}><button type="button" className={styles.link} onClick={() => setOpen(false)}>Done</button></div></Popover>}
    </>
  );
}

// Date and time together, as one value 'YYYY-MM-DDTHH:mm' (what <input type="datetime-local"> uses).
export function DateTimeInput({ value, onChange, min, max, placeholder = 'Pick a date and time', ...rest }: Common & { min?: string; max?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const [d, t] = value.includes('T') ? value.split('T') : [value, ''];
  const text = d ? `${fmtDate(d)}${t ? ` · ${fmtTime(t)}` : ''}` : '';
  const set = (nd: string, nt: string) => emit(onChange, `${nd || todayKey()}T${nt || '17:00'}`);
  return (
    <>
      <Trigger tref={ref} icon={<CalendarDays size={15} className={styles.icon} aria-hidden="true" />} text={text} placeholder={placeholder} value={value} open={open} onToggle={() => setOpen((o) => !o)} {...rest} />
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} width={288} label="Choose a date and time">
          <Calendar value={d} min={min?.slice(0, 10)} max={max?.slice(0, 10)} onPick={(k) => set(k, t)} />
          <div className={styles.timeHead}><Clock size={13} aria-hidden="true" /> {t ? fmtTime(t) : 'Time'}</div>
          <TimeColumns value={t} onPick={(hhmm) => set(d, hhmm)} />
          <div className={styles.calFoot}><button type="button" className={styles.link} onClick={() => setOpen(false)}>Done</button></div>
        </Popover>
      )}
    </>
  );
}
