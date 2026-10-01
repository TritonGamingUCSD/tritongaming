'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
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
        <IconButton kind="analytics" href={`/portal/events/${eventId}/summary`} label={`Summary for ${title}`} />
      )}
      {canEdit && (
        <IconButton kind="edit" href={`/portal/events/${eventId}`} label={`Edit ${title}`} />
      )}
      {canEdit && hasMore && (
        <div className={styles.moreWrap}>
          <IconButton kind="more" label={`More actions for ${title}`} aria-haspopup="menu" aria-expanded={open} active={open} onClick={() => setOpen((o) => !o)} />
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
