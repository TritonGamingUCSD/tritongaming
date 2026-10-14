'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { saveTheme } from '@/lib/portal/themeScript';
import styles from './PortalThemeToggle.module.css';

type Mode = 'light' | 'dark';

// Light or dark for the portal only (the public site stays as designed). The theme is settled before first paint by the script in the portal layout
// (see lib/portal/themeScript.ts) and then only changes when this is tapped; the choice is remembered on this browser.
export default function PortalThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const [mode, setMode] = useState<Mode>('dark');
  useEffect(() => {
    setMode(document.documentElement.getAttribute('data-pp-theme') === 'light' ? 'light' : 'dark');
  }, []);
  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    saveTheme(next);
  };
  return (
    <button type="button" className={`${styles.btn} ${labelled ? styles.labelled : ''}`} onClick={toggle} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
      {mode === 'dark' ? <Sun size={17} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={17} strokeWidth={1.75} aria-hidden="true" />}
      {labelled && <span>{mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}</span>}
    </button>
  );
}
