'use client';

import { useEffect, useState } from 'react';
import { useSiteSettings } from '@/components/portal/SiteSettingsProvider';
import { styleFor, type CodeStyle, type CodeUse } from '@/lib/portal/siteSettings';

// Which code this device draws for the person's own tickets, meeting codes and reward pickups: the TGcode, the Bytecode (Byte) or a QR code, for each of the three separately. The Admins choose for
// everyone (Admin → System → Settings); a device can choose for itself (in Previews, to try another one) and that choice wins on that device only. The Scan page reads both, so nothing has to match between two phones.
export type { CodeStyle };
const key = (use: CodeUse) => `tg-code-style-${use}`;
const EVENT = 'tg:code-style';

const read = (use: CodeUse): CodeStyle | null => {
  try {
    const v = window.localStorage.getItem(key(use));
    return v === 'byte' || v === 'tg' || v === 'qr' ? v : null;
  } catch {
    return null;
  }
};

/** Sets this device's own choice for one use, or with 'site' goes back to following the Admins' setting. */
export function setCodeStyle(use: CodeUse, style: CodeStyle | 'site') {
  try {
    if (style === 'site') window.localStorage.removeItem(key(use));
    else window.localStorage.setItem(key(use), style);
  } catch {
    /* kept for this page only */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** What this device chose for itself for a use, or null when it follows the site's setting. */
export function useDeviceCodeStyle(use: CodeUse): CodeStyle | null {
  const [style, setStyle] = useState<CodeStyle | null>(null); // (the server and the first paint follow the site; this device's choice is read right after)
  useEffect(() => {
    const sync = () => setStyle(read(use));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [use]);
  return style;
}

/** The code to draw for a use: this device's own choice, else the Admins' setting for it, else their default. Without a use (an icon for "a code" in general): the Admins' default. */
export function useCodeStyle(use?: CodeUse): CodeStyle {
  const own = useDeviceCodeStyle(use ?? 'ticket');
  const site = styleFor(useSiteSettings(), use);
  return (use && own) || site;
}
