'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert, X } from 'lucide-react';
import styles from './Dialog.module.css';

// The one dialog shell for the whole site: backdrop, white sheet, close button,
// icon + title. Used by every confirm-type dialog (hold-to-confirm, delete event,
// undo check-in, delete account) so they all look and behave the same — Escape
// and backdrop-click close it (unless `busy`), body scroll is locked while open.
// Content goes in as children; <DialogActions> lays out the button row.
export default function Dialog({
  title, tone = 'default', busy = false, onClose, children, label,
}: {
  title: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [busy, onClose]);

  return createPortal(
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={styles.sheet} role="alertdialog" aria-modal="true" aria-label={label ?? title}>
        <button type="button" className={styles.close} onClick={onClose} disabled={busy} aria-label="Close">
          <X size={18} strokeWidth={1.75} />
        </button>
        {tone === 'danger' && <div className={styles.icon}><TriangleAlert size={26} strokeWidth={1.75} aria-hidden="true" /></div>}
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogText({ children }: { children: ReactNode }) {
  return <p className={styles.text}>{children}</p>;
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function DialogCancel({ onClick, disabled, children = 'Cancel' }: { onClick: () => void; disabled?: boolean; children?: ReactNode }) {
  return <button type="button" className={styles.cancel} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function DialogCheck({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function DialogInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={styles.input} />;
}

export function DialogSearch({ children }: { children: ReactNode }) {
  return <div className={styles.searchWrap}>{children}</div>;
}

export function DialogResults({ children }: { children: ReactNode }) {
  return <div className={styles.results}>{children}</div>;
}

export function DialogResult({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" className={styles.result} onClick={onClick}>{children}</button>;
}

export function DialogKicker({ children }: { children: ReactNode }) {
  return <p className={styles.kicker}>{children}</p>;
}

export function DialogList({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}

export function DialogDanger({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" className={styles.danger} onClick={onClick} disabled={disabled}>{children}</button>;
}

// A checkbox on a tinted card, for the "also do X" choice inside a dialog.
export function DialogOption({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <div className={styles.checkBox}>
      <DialogCheck checked={checked} onChange={onChange}>{children}</DialogCheck>
    </div>
  );
}
