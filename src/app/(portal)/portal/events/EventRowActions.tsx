'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Pencil, MoreHorizontal, ExternalLink, Trash2 } from 'lucide-react';
import styles from './events.module.css';

// Per-row actions for the events table: the two things people actually do
// (Summary, Edit) as labelled icon buttons, and the rest (Preview AS Form,
// Delete) tucked into a "more" menu so a row never turns into a pile of links.
export default function EventRowActions({
  eventId, title, showSummary, canEdit, previewUrl, canDelete, onDelete,
}: {
  eventId: string;
  title: string;
  showSummary: boolean;
  canEdit: boolean;
  previewUrl?: string | null;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasMore = !!previewUrl || canDelete;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setOpen(false); return; }
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div className={styles.rowActions} ref={ref}>
      {showSummary && (
        <Link href={`/portal/events/${eventId}/summary`} className={styles.iconAction} aria-label={`Summary for ${title}`} title="Summary">
          <BarChart3 size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      )}
      {canEdit && (
        <Link href={`/portal/events/${eventId}`} className={styles.iconAction} aria-label={`Edit ${title}`} title="Edit">
          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      )}
      {canEdit && hasMore && (
        <div className={styles.moreWrap}>
          <button type="button" className={styles.iconAction} aria-label={`More actions for ${title}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {open && (
            <div className={styles.moreMenu} role="menu">
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
                  <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" /> Preview AS Form
                </a>
              )}
              {canDelete && (
                <button type="button" className={`${styles.menuItem} ${styles.menuDanger}`} role="menuitem" onClick={() => { setOpen(false); onDelete(); }}>
                  <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Delete event
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
