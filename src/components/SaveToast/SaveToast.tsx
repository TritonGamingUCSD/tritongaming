'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import styles from './SaveToast.module.css';

// A clear, hard-to-miss "your changes were saved" confirmation — a green banner
// that slides in at the top of the screen (the small button label alone was
// easy to overlook). Render it while the "just saved" state is true; the
// caller already clears that state after a few seconds.
export default function SaveToast({ message = 'Changes saved', warn = false }: { message?: string; warn?: boolean }) {
  return (
    <div className={`${styles.toast} ${warn ? styles.warn : ''}`} role={warn ? 'alert' : 'status'} aria-live="polite">
      {warn ? <AlertTriangle size={22} strokeWidth={2.25} aria-hidden="true" /> : <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}
