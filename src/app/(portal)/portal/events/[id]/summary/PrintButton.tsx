'use client';

import { Printer } from 'lucide-react';
import styles from './summary.module.css';

export default function PrintButton() {
  return (
    <button type="button" className={styles.actionBtn} onClick={() => window.print()}>
      <Printer size={15} strokeWidth={1.5} aria-hidden="true" /> Save as PDF
    </button>
  );
}
