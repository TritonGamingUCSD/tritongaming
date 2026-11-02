'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert, X } from 'lucide-react';
import styles from './Dialog.module.css';

// The one dialog shell for the whole site: backdrop, white sheet, close button,
// icon + title. Used by every confirm-type dialog (hold-to-confirm, delete event,
// undo check-in, delete account) so they all look and behave the same — Escape
// and backdrop-click close it (unless `busy`), body scroll is locked while open.
// Content goes in as children; <DialogActions> lays out the button row.
// `dirty` (the dialog holds edits that are not saved): Escape, a click outside and the X do not close it; the window shakes and goes red until they save, or press Cancel to throw the edits away.

export default function Dialog({
  title,
  tone = 'default',
  busy = false,
  dirty = false,
  wide = false,
  sheet = false,
  onClose,
  children,
  label,
}: {
  wide?: boolean;
  sheet?: boolean; // on a phone it fills the screen, with its buttons pinned to the bottom
  title: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  dirty?: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [warned, setWarned] = useState(false);
  const attempt = useCallback(() => {
    if (dirty && !busy) {
      setWarned(true);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        sheetRef.current?.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-9px)' },
            { transform: 'translateX(9px)' },
            { transform: 'translateX(-7px)' },
            { transform: 'translateX(7px)' },
            { transform: 'translateX(-3px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 420, easing: 'ease-out' },
        );
    } else onClose();
  }, [dirty, busy, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) attempt();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, attempt]);

  return createPortal(
    <div
      className={`${styles.backdrop} ${sheet ? styles.backdropSheet : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) attempt();
      }}
    >
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${wide ? styles.wide : ''} ${sheet ? styles.sheetFull : ''} ${warned && dirty ? styles.warned : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={label ?? title}
      >
        <button type="button" className={styles.close} onClick={() => attempt()} disabled={busy} aria-label="Close">
          <X size={18} strokeWidth={1.75} />
        </button>
        {tone === 'danger' && (
          <div className={styles.icon}>
            <TriangleAlert size={26} strokeWidth={1.75} aria-hidden="true" />
          </div>
        )}
        <h2 className={styles.title}>{title}</h2>
        {warned && dirty && (
          <p className={styles.unsaved} role="alert">
            You have unsaved changes. Save them, or press Cancel to throw them away.
          </p>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogText({ children }: { children: ReactNode }) {
  return <p className={styles.text}>{children}</p>;
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function DialogCancel({ onClick, disabled, children = 'Cancel' }: { onClick: () => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <button type="button" className={styles.cancel} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
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
  return (
    <button type="button" className={styles.result} onClick={onClick}>
      {children}
    </button>
  );
}

export function DialogKicker({ children }: { children: ReactNode }) {
  return <p className={styles.kicker}>{children}</p>;
}

export function DialogList({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}

export function DialogDanger({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={styles.danger} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// A checkbox on a tinted card, for the "also do X" choice inside a dialog.
export function DialogOption({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <div className={styles.checkBox}>
      <DialogCheck checked={checked} onChange={onChange}>
        {children}
      </DialogCheck>
    </div>
  );
}
