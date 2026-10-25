'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { refreshPortal, REFRESHED_EVENT } from '@/lib/ui/refreshPortal';
import { confirmDiscardUnsaved } from '@/lib/ui/useUnsavedChanges';
import styles from './PortalThemeToggle.module.css';

// The refresh button in the portal's top bar: fetches the page's data again without leaving it (an installed app has no reload of its own).
export default function PortalRefresh({ labelled = false }: { labelled?: boolean }) {
  const [spin, setSpin] = useState(false);
  const stop = useRef<number | undefined>(undefined);
  useEffect(() => {
    const done = () => { window.clearTimeout(stop.current); stop.current = window.setTimeout(() => setSpin(false), 400); };
    window.addEventListener(REFRESHED_EVENT, done);
    return () => { window.removeEventListener(REFRESHED_EVENT, done); window.clearTimeout(stop.current); };
  }, []);
  const go = () => {
    if (spin || !confirmDiscardUnsaved()) return;
    setSpin(true);
    window.clearTimeout(stop.current);
    stop.current = window.setTimeout(() => setSpin(false), 8000);   // never spins for ever if the answer is lost
    refreshPortal();
  };
  return (
    <button type="button" className={`${styles.btn} ${labelled ? styles.labelled : ''}`} onClick={go} aria-label="Refresh this page" title="Refresh this page">
      <RefreshCw size={17} strokeWidth={1.75} aria-hidden="true" className={spin ? styles.spin : undefined} />
      {labelled && <span>Refresh</span>}
    </button>
  );
}
