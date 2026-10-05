'use client';

import type { ReactNode } from 'react';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import styles from './docs.module.css';

export interface ConflictAction { label: string; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; onClick: () => void; busy?: boolean; hint?: string }

// One dialog for every "someone else changed this" moment: what happened, who did it, and a clear choice of what to do about it. Nothing is overwritten
// until a person picks an action here.
export default function ConflictDialog({ title, tone = 'default', summary, children, actions, onClose, cancelLabel = 'Cancel' }: {
  title: string; tone?: 'default' | 'danger'; summary: ReactNode; children?: ReactNode; actions: ConflictAction[]; onClose: () => void; cancelLabel?: string;
}) {
  const busy = actions.some((a) => a.busy);
  return (
    <Dialog title={title} tone={tone} busy={busy} onClose={onClose}>
      <DialogText>{summary}</DialogText>
      {children}
      <ul className={styles.choiceList}>
        {actions.map((a) => (
          <li key={a.label} className={styles.choice}>
            <button type="button" className={`${styles.choiceBtn} ${styles['choice_' + (a.variant ?? 'secondary')]}`} disabled={busy && !a.busy} onClick={a.onClick}>{a.busy ? 'Working…' : a.label}</button>
            {a.hint && <span className={styles.choiceHint}>{a.hint}</span>}
          </li>
        ))}
      </ul>
      <DialogActions><DialogCancel onClick={onClose} disabled={busy}>{cancelLabel}</DialogCancel></DialogActions>
    </Dialog>
  );
}
