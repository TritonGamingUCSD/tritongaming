'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import { UNSAVED_BLOCKED_EVENT, registerSaveBar } from '@/lib/useUnsavedChanges';
import styles from './SaveBar.module.css';

// The one way every editing form saves: a bar sticks to the bottom as soon as there is anything unsaved, with Discard and Save changes.
// While it shows, leaving the page is refused (links, Back, the portal's own navigation) and the bar shakes red until one is chosen.
export default function SaveBar({ dirty, saving = false, onSave, onDiscard, formId, saveLabel = 'Save changes', discardLabel = 'Discard', discarding = false, saveDisabled = false, blocking = true, floating = true, message = 'You have unsaved changes' }: {
  dirty: boolean; saving?: boolean; onSave?: () => void; onDiscard: () => void; formId?: string; saveLabel?: string; discardLabel?: string; discarding?: boolean; saveDisabled?: boolean;
  /** false where the work is already kept safe (a doc's autosaved draft): the bar offers Publish/Discard but never stops anyone leaving. */
  blocking?: boolean;
  /** Fixed to the bottom of the window by default, so it is always in reach whatever part of the page is being edited. Pass false to let it sit at the end of its section. */
  floating?: boolean; message?: string;
}) {
  const [shake, setShake] = useState(0);
  // Centred over the page content, not the whole window: the bar follows the content column (to the right of the sidebar) as the sidebar opens and closes.
  const [span, setSpan] = useState<{ left: number; right: number } | null>(null);
  useEffect(() => {
    if (!dirty || !floating) return;
    const place = () => {
      const el = document.querySelector('[data-save-anchor]');
      if (!el) { setSpan(null); return; }
      const r = el.getBoundingClientRect();
      setSpan({ left: Math.max(0, r.left), right: Math.max(0, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener('resize', place);
    const t = window.setInterval(place, 400);   // the sidebar slides open and shut without a resize
    return () => { window.removeEventListener('resize', place); window.clearInterval(t); };
  }, [dirty, floating]);
  useEffect(() => (dirty && blocking ? registerSaveBar() : undefined), [dirty, blocking]);
  useEffect(() => {
    if (!dirty) return;
    const on = () => setShake((n) => n + 1);
    window.addEventListener(UNSAVED_BLOCKED_EVENT, on);
    return () => window.removeEventListener(UNSAVED_BLOCKED_EVENT, on);
  }, [dirty]);
  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(0), 650);
    return () => clearTimeout(t);
  }, [shake]);
  if (!dirty) return null;
  const bar = (
    <div className={`${styles.wrap} ${floating ? styles.floating : ''}`} style={floating && span ? { left: span.left, right: span.right } : undefined}>
      <div key={shake} className={`${styles.bar} ${shake ? styles.alert : ''}`} role="region" aria-label="Unsaved changes">
        <p className={styles.msg} role={shake ? 'alert' : undefined}>{shake ? 'Save or discard your changes before leaving.' : message}</p>
        <div className={styles.actions}>
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving} loading={discarding}>{discardLabel}</Button>
          <Button type={formId ? 'submit' : 'button'} form={formId} size="sm" onClick={formId ? undefined : onSave} loading={saving} disabled={saveDisabled}>{saveLabel}</Button>
        </div>
      </div>
    </div>
  );
  return floating && typeof document !== 'undefined' ? createPortal(bar, document.body) : bar;
}
