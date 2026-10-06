'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import styles from './PortalThemeToggle.module.css';

type Mode = 'light' | 'dark';
const KEY = 'tg_portal_theme';

function systemMode(): Mode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Light or dark for the portal only (the public site stays as designed). With no choice made it follows the device;
// the first tap pins a choice, remembered on this browser. The same value is applied before first paint by the script in
// the portal layout, so a refresh never flashes the wrong theme.
export default function PortalThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const [mode, setMode] = useState<Mode>('dark');
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
    setMode(saved === 'light' || saved === 'dark' ? saved : systemMode());
  }, []);
  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    document.documentElement.setAttribute('data-pp-theme', next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  };
  return (
    <button type="button" className={`${styles.btn} ${labelled ? styles.labelled : ''}`} onClick={toggle} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
      {mode === 'dark' ? <Sun size={17} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={17} strokeWidth={1.75} aria-hidden="true" />}
      {labelled && <span>{mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}</span>}
    </button>
  );
}
