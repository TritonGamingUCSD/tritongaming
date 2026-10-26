'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { refreshPortal, REFRESH_EVENT, REFRESHED_EVENT } from '@/lib/ui/refreshPortal';
import { confirmDiscardUnsaved } from '@/lib/ui/useUnsavedChanges';
import styles from './PortalThemeToggle.module.css';

// The refresh button in the portal's desktop top bar (a phone refreshes by pulling the page down, see PullToRefresh.tsx): fetches the page's data again without leaving it (an installed app has no reload of its own).
export default function PortalRefresh() {
  const [spin, setSpin] = useState(false);
  const stop = useRef<number | undefined>(undefined);
  useEffect(() => {
    const done = () => { window.clearTimeout(stop.current); stop.current = window.setTimeout(() => setSpin(false), 400); };
    // Whoever asks for a refresh (this button, the pull-down, coming back to the app) makes the button spin until the answer is in.
    const began = () => { setSpin(true); window.clearTimeout(stop.current); stop.current = window.setTimeout(() => setSpin(false), 8000); };   // never spins for ever if the answer is lost
    window.addEventListener(REFRESH_EVENT, began);
    window.addEventListener(REFRESHED_EVENT, done);
    return () => { window.removeEventListener(REFRESH_EVENT, began); window.removeEventListener(REFRESHED_EVENT, done); window.clearTimeout(stop.current); };
  }, []);
  const go = () => {
    if (spin || !confirmDiscardUnsaved()) return;
    refreshPortal();
  };
  return (
    <button type="button" className={styles.btn} onClick={go} aria-label="Refresh this page" title="Refresh this page">
      <RefreshCw size={17} strokeWidth={1.75} aria-hidden="true" className={spin ? styles.spin : undefined} />
    </button>
  );
}
