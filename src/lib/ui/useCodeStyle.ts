'use client';

import { useEffect, useState } from 'react';
import { useSiteSettings } from '@/components/portal/SiteSettingsProvider';
import type { CodeStyle } from '@/lib/portal/siteSettings';

// Which code this device draws for the person's own tickets, meeting codes and reward pickups: the TGcode or the Bytecode (Byte). The Admins choose it for everyone (Admin → System → Settings);
// a device can choose for itself (in Previews, to try the other one) and that choice wins on that device only. The Scan page reads both, so nothing has to match between two phones.
export type { CodeStyle };
const KEY = 'tg-code-style';
const EVENT = 'tg:code-style';

const read = (): CodeStyle | null => {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'byte' || v === 'tg' ? v : null;
  } catch {
    return null;
  }
};

/** Sets this device's own choice, or with 'site' goes back to following the Admins' setting. */
export function setCodeStyle(style: CodeStyle | 'site') {
  try {
    if (style === 'site') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, style);
  } catch {
    /* kept for this page only */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** What this device chose for itself, or null when it follows the site's setting. */
export function useDeviceCodeStyle(): CodeStyle | null {
  const [style, setStyle] = useState<CodeStyle | null>(null); // (the server and the first paint follow the site; this device's choice is read right after)
  useEffect(() => {
    const sync = () => setStyle(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return style;
}

/** The code to draw here: this device's own choice, else the Admins' setting for everyone. */
export function useCodeStyle(): CodeStyle {
  const own = useDeviceCodeStyle();
  const site = useSiteSettings().codeStyle;
  return own ?? site;
}
