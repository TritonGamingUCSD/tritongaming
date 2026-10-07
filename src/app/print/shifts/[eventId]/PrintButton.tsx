'use client';

import { Printer } from 'lucide-react';
import styles from './print.module.css';

export default function PrintButton() {
  return <button type="button" className={styles.printBtn} onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print or save as PDF</button>;
}
