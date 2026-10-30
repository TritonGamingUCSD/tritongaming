'use client';

import { useEffect, useState } from 'react';

// Which code this device draws for the person's own tickets, meeting codes and reward pickups: the TGcode (the default) or the Bytecode (Byte). It is only a choice of this device's
// drawing, kept in this browser; the Scan page reads both either way, so nothing has to match between the two phones. Changed from /portal/preview.
export type CodeStyle = 'tg' | 'byte';
const KEY = 'tg-code-style';
const EVENT = 'tg:code-style';

const read = (): CodeStyle => {
  try {
    return window.localStorage.getItem(KEY) === 'byte' ? 'byte' : 'tg';
  } catch {
    return 'tg';
  }
};

export function setCodeStyle(style: CodeStyle) {
  try {
    window.localStorage.setItem(KEY, style);
  } catch {
    /* kept for this page only */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCodeStyle(): CodeStyle {
  const [style, setStyle] = useState<CodeStyle>('tg'); // (the server and the first paint draw the TGcode; this device's choice is read right after)
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
