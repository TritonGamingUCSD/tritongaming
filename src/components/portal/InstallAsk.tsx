'use client';

import IconButton from '@/components/ui/IconButton';
import { useEffect, useRef, useState } from 'react';
import { Share, Smartphone } from 'lucide-react';
import styles from './PushAsk.module.css';

const KEY = 'install-asked';
const AGAIN_AFTER_MS = 30 * 86_400_000; // "not now" is respected for a month

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The offer to put the portal on the home screen, on a phone, when it is not already there. Android and Chrome give a real install button (the browser's own install event);
// iPhones and iPads have no such button for a web page, so the card says where to tap (Share, then Add to Home Screen). Shown a little after the page settles and after the
// notifications offer has had its turn; "Not now" is remembered for a month, installing for good. Anything added from any page is the portal (see public/portal.webmanifest).
export default function InstallAsk() {
  const [mode, setMode] = useState<'android' | 'ios' | null>(null);
  const [busy, setBusy] = useState(false);
  const stash = useRef<InstallEvent | null>(null);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      const phone = window.matchMedia('(max-width: 899px)').matches && window.matchMedia('(pointer: coarse)').matches;
      const last = Number(localStorage.getItem(KEY) ?? 0);
      if (standalone || !phone || (last && Date.now() - last < AGAIN_AFTER_MS)) return;
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      // A moment after the page settles, and not on top of the notifications offer.
      const offer = (m: 'android' | 'ios') => {
        timer = setTimeout(() => {
          if (live && !document.querySelector('[aria-label="Turn on notifications"]')) setMode(m);
        }, 9000);
      };
      if (ios) offer('ios');
      const onPrompt = (e: Event) => {
        e.preventDefault();
        stash.current = e as InstallEvent;
        offer('android');
      };
      const early = (window as unknown as { __tgInstall?: Event }).__tgInstall; // announced before this component was ready (see the script in app/layout.tsx)
      if (early) onPrompt(early);
      const onInstalled = () => {
        try {
          localStorage.setItem(KEY, String(Date.now() + 10 * 365 * 86_400_000));
        } catch {
          /* ignore */
        }
        setMode(null);
      };
      window.addEventListener('beforeinstallprompt', onPrompt);
      window.addEventListener('appinstalled', onInstalled);
      return () => {
        live = false;
        if (timer) clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', onInstalled);
      };
    } catch {
      /* no offer */
    }
  }, []);

  function remember() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }
  function notNow() {
    setMode(null);
    remember();
  }
  async function install() {
    const e = stash.current;
    if (!e) return;
    setBusy(true);
    try {
      await e.prompt();
      const { outcome } = await e.userChoice;
      if (outcome === 'accepted') localStorage.setItem(KEY, String(Date.now() + 10 * 365 * 86_400_000));
      else remember();
    } catch {
      remember();
    }
    stash.current = null;
    setBusy(false);
    setMode(null);
  }

  if (!mode) return null;
  return (
    <div className={styles.wrap} role="dialog" aria-label="Add the portal to your home screen">
      <span className={styles.icon}>
        <Smartphone size={18} aria-hidden="true" />
      </span>
      <div className={styles.text}>
        <strong>Add the portal to your home screen</strong>
        {mode === 'ios' ? (
          <span>
            Tap <Share size={13} aria-label="Share" style={{ verticalAlign: '-2px' }} /> at the bottom of Safari, then <b>Add to Home Screen</b>. Your tickets and Scan are one tap
            away.
          </span>
        ) : (
          <span>Open it like an app, with your tickets and Scan one tap away.</span>
        )}
      </div>
      <div className={styles.buttons}>
        {mode === 'android' && (
          <button type="button" className={styles.on} onClick={install} disabled={busy}>
            Install
          </button>
        )}
        <button type="button" className={mode === 'ios' ? styles.on : styles.no} onClick={notNow} disabled={busy}>
          {mode === 'ios' ? 'Got it' : 'Not now'}
        </button>
      </div>
      <IconButton kind="close" size="sm" label="Close" className={styles.close} onClick={notNow} />
    </div>
  );
}
