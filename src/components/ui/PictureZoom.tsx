'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './PictureZoom.module.css';

// A picture shown large over the page: click outside it, press Escape or the close button to leave. `children` are buttons under the picture (for example Change Picture). While it is open the keys belong to it (Escape, Space and Enter
// do not reach a page behind, like the draw screen's own keys).
export function PictureZoom({ src, title, onClose, children }: { src: string; title: string; onClose: () => void; children?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.stopImmediatePropagation();
        if (e.key === 'Escape') onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.box} role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.img} src={src} alt={title} />
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.actions}>{children}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** A picture that opens large when it is clicked (a button around the image, so the keyboard works too). `actions` show under the large picture. */
export function ZoomImg({ src, alt, className, actions }: { src: string; alt: string; className?: string; actions?: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={styles.thumb} onClick={() => setOpen(true)} aria-label={`Show ${alt} larger`} title="Click to enlarge">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={className} src={src} alt={alt} loading="lazy" />
      </button>
      {open && (
        <PictureZoom src={src} title={alt} onClose={() => setOpen(false)}>
          {actions?.(() => setOpen(false))}
        </PictureZoom>
      )}
    </>
  );
}
